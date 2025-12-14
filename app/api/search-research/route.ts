import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth";
import { generateEmbedding, cosineSimilarity, parseEmbedding } from "@/lib/ml";
import { trackEvent } from "@/lib/analytics";
import { NextRequest, NextResponse } from "next/server";
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'podcasts.db');

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { query, limit = 50 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`Searching research topics for: "${query}"`);

    // Track search event
    const userId = (session.user as any).id;
    trackEvent(userId, 'research_search', { query, limit });

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Open database
    const db = new Database(DB_PATH, { readonly: true });

    // Get all research topics with embeddings
    const topics = db.prepare(`
      SELECT id, video_url, title, date, topic_title, comprehensive_summary, summary_embedding
      FROM research_topics
      WHERE summary_embedding IS NOT NULL
    `).all() as Array<{
      id: number;
      video_url: string;
      title: string;
      date: string;
      topic_title: string;
      comprehensive_summary: string;
      summary_embedding: Buffer;
    }>;

    if (topics.length === 0) {
      db.close();
      return NextResponse.json({ results: [] });
    }

    // Calculate similarities
    const results = topics.map(topic => {
      const topicEmbedding = parseEmbedding(topic.summary_embedding);
      const similarity = cosineSimilarity(queryEmbedding, topicEmbedding);

      return {
        id: topic.id,
        video_url: topic.video_url,
        title: topic.title,
        date: topic.date,
        topic_title: topic.topic_title,
        comprehensive_summary: topic.comprehensive_summary,
        similarity
      };
    });

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    // Get top results
    const topResults = results.slice(0, limit);

    // For each top result, get its clips
    for (const result of topResults) {
      const clips = db.prepare(`
        SELECT timestamp, timestamp_seconds, clip_summary, speaker
        FROM research_clips
        WHERE topic_id = ?
        ORDER BY timestamp_seconds ASC
      `).all(result.id);

      (result as any).clips = clips;
    }

    db.close();

    console.log(`  Found ${results.length} topics, returning top ${topResults.length}`);

    return NextResponse.json({ results: topResults });
  } catch (error: any) {
    console.error('Research search error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
