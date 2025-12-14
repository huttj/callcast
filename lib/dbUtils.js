let db = null;
let embeddingCache = new Map();

/**
 * Wait for sql.js to load from CDN
 */
function waitForSqlJs() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.initSqlJs) {
      resolve(window.initSqlJs);
    } else {
      const checkInterval = setInterval(() => {
        if (typeof window !== 'undefined' && window.initSqlJs) {
          clearInterval(checkInterval);
          resolve(window.initSqlJs);
        }
      }, 100);
    }
  });
}

/**
 * Initialize the database from a file
 */
export async function initDatabase(dbPath = '/podcasts.db') {
  // Wait for sql.js to load from CDN
  const initSqlJs = await waitForSqlJs();

  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });

  try {
    const response = await fetch(dbPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch database: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buffer));
    console.log('✓ Database loaded successfully');

    // Verify it has data
    const stmt = db.prepare('SELECT COUNT(*) as count FROM utterances');
    stmt.step();
    const result = stmt.getAsObject();
    stmt.free();
    console.log(`  Found ${result.count} utterances in database`);
  } catch (error) {
    console.error('Failed to load database:', error);
    throw error;
  }

  return db;
}

/**
 * Initialize the embedding model
 * Checks if API server is available
 */
export async function initModel() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();

    if (data.modelLoaded) {
      console.log('✓ Embedding API server connected');
      return true;
    } else {
      console.warn('⚠ Embedding API server starting...');
      return false;
    }
  } catch (error) {
    console.warn('⚠ Embedding API server not available. Start it with: npm run api');
    console.warn('  Using fallback keyword search (lower quality results)');
    return false;
  }
}

/**
 * Generate embedding for text using API server
 * Falls back to simple keyword matching if API unavailable
 */
export async function generateEmbedding(text) {
  // Check cache first
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }

  try {
    // Try to use API server first
    const response = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (response.ok) {
      const data = await response.json();
      embeddingCache.set(text, data.embedding);
      return data.embedding;
    }
  } catch (error) {
    // API not available, fall back to keyword search
  }

  // Fallback: simple keyword-based embedding
  const tokens = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  const embedding = new Array(384).fill(0);

  tokens.forEach((token) => {
    const hash = token.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    const position = Math.abs(hash) % 384;
    embedding[position] += 1 / Math.sqrt(tokens.length);
  });

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  const normalized = magnitude > 0
    ? embedding.map(val => val / magnitude)
    : embedding;

  embeddingCache.set(text, normalized);
  return normalized;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search for similar utterances
 */
export async function searchUtterances(query, filters = {}, limit = 20) {
  if (!db) {
    await initDatabase();
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build SQL query with filters
  let sql = 'SELECT * FROM utterances';
  const conditions = [];
  const params = [];

  if (filters.speaker && filters.speaker.length > 0) {
    conditions.push(`speaker IN (${filters.speaker.map(() => '?').join(',')})`);
    params.push(...filters.speaker);
  }

  if (filters.startDate) {
    conditions.push('date >= ?');
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('date <= ?');
    params.push(filters.endDate);
  }

  if (filters.hasAiSummary) {
    conditions.push('ai_summary IS NOT NULL');
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // Execute query
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();

    // Prefer summary_embedding if available, otherwise use regular embedding
    const embeddingBuffer = row.summary_embedding || row.embedding;
    const embeddingArray = new Float32Array(embeddingBuffer.buffer || embeddingBuffer);
    const embedding = Array.from(embeddingArray);

    // Calculate similarity
    const similarity = cosineSimilarity(queryEmbedding, embedding);

    results.push({
      ...row,
      similarity,
      embedding: undefined, // Remove embedding from result to save memory
      summary_embedding: undefined // Remove summary_embedding from result to save memory
    });
  }
  stmt.free();

  // Sort by similarity and return top results
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

/**
 * Get all unique speakers
 */
export function getSpeakers() {
  if (!db) {
    return [];
  }

  const stmt = db.prepare('SELECT DISTINCT speaker FROM utterances ORDER BY speaker');
  const speakers = [];

  while (stmt.step()) {
    speakers.push(stmt.getAsObject().speaker);
  }
  stmt.free();

  return speakers;
}

/**
 * Get date range of all episodes
 */
export function getDateRange() {
  if (!db) {
    return { min: null, max: null };
  }

  const stmt = db.prepare('SELECT MIN(date) as min, MAX(date) as max FROM utterances');
  stmt.step();
  const result = stmt.getAsObject();
  stmt.free();

  return result;
}

/**
 * Get all episodes (unique video URLs with metadata)
 */
export function getEpisodes() {
  if (!db) {
    return [];
  }

  const stmt = db.prepare(`
    SELECT DISTINCT video_url, title, date
    FROM utterances
    ORDER BY date DESC
  `);

  const episodes = [];
  while (stmt.step()) {
    episodes.push(stmt.getAsObject());
  }
  stmt.free();

  return episodes;
}

/**
 * Get full transcript for a specific video
 */
export function getFullTranscript(videoUrl) {
  if (!db) {
    return [];
  }

  const stmt = db.prepare(`
    SELECT id, speaker, timestamp, timestamp_seconds, text, ai_summary
    FROM utterances
    WHERE video_url = ?
    ORDER BY timestamp_seconds ASC
  `);

  stmt.bind([videoUrl]);

  const utterances = [];
  while (stmt.step()) {
    utterances.push(stmt.getAsObject());
  }
  stmt.free();

  return utterances;
}

/**
 * Get statistics for visualization
 */
export function getStatistics(results) {
  if (!results || results.length === 0) {
    return {
      bySpeaker: [],
      byDate: [],
      byEpisode: []
    };
  }

  // Count by speaker
  const speakerCounts = {};
  results.forEach(r => {
    speakerCounts[r.speaker] = (speakerCounts[r.speaker] || 0) + 1;
  });

  const bySpeaker = Object.entries(speakerCounts)
    .map(([speaker, count]) => ({ speaker, count }))
    .sort((a, b) => b.count - a.count);

  // Count by date
  const dateCounts = {};
  results.forEach(r => {
    dateCounts[r.date] = (dateCounts[r.date] || 0) + 1;
  });

  const byDate = Object.entries(dateCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Count by episode
  const episodeCounts = {};
  results.forEach(r => {
    const key = `${r.title}`;
    episodeCounts[key] = (episodeCounts[key] || 0) + 1;
  });

  const byEpisode = Object.entries(episodeCounts)
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count);

  return { bySpeaker, byDate, byEpisode };
}

/**
 * Search research topics using semantic search via API
 */
export async function searchResearchTopics(query, limit = 50) {
  if (!query || !query.trim()) {
    return [];
  }

  try {
    // Use API server for semantic search
    const response = await fetch('/api/search-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Failed to search research topics:', error);
    console.warn('Make sure API server is running: npm run api');
    return [];
  }
}
