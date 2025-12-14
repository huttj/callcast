import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth";
import { generateEmbedding, cosineSimilarity, parseEmbedding } from "@/lib/ml";
import { trackEvent } from "@/lib/analytics";
import { callLLM, Message } from "@/lib/llm";
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
    const { query, conversationHistory = [] } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`Research chat query: "${query}"`);
    console.log(`  Conversation history: ${conversationHistory.length} messages`);

    // Track chat query event
    const userId = (session.user as any).id;
    trackEvent(userId, 'research_chat', { query, historyLength: conversationHistory.length });

    // 1. Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    const db = new Database(DB_PATH, { readonly: true });

    // 2. Search research topics
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

    const topicResults = topics.map(topic => {
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
    }).sort((a, b) => b.similarity - a.similarity).slice(0, 5);

    // 3. Get clips for top topics
    for (const topic of topicResults) {
      const clips = db.prepare(`
        SELECT timestamp, timestamp_seconds, clip_summary, speaker
        FROM research_clips
        WHERE topic_id = ?
        ORDER BY timestamp_seconds ASC
      `).all(topic.id);
      (topic as any).clips = clips;
    }

    // 4. Get relevant utterances
    const utterances = db.prepare(`
      SELECT id, speaker, timestamp, timestamp_seconds, text, video_url, title, date, embedding
      FROM utterances
      WHERE embedding IS NOT NULL
    `).all() as Array<{
      id: number;
      speaker: string;
      timestamp: string;
      timestamp_seconds: number;
      text: string;
      video_url: string;
      title: string;
      date: string;
      embedding: Buffer;
    }>;

    const utteranceResults = utterances.map(utt => {
      const uttEmbedding = parseEmbedding(utt.embedding);
      const similarity = cosineSimilarity(queryEmbedding, uttEmbedding);

      return {
        speaker: utt.speaker,
        timestamp: utt.timestamp,
        timestamp_seconds: utt.timestamp_seconds,
        text: utt.text,
        video_url: utt.video_url,
        title: utt.title,
        date: utt.date,
        similarity
      };
    }).sort((a, b) => b.similarity - a.similarity).slice(0, 10);

    db.close();

    // 5. Build context for LLM
    let context = 'RESEARCH TOPICS:\n\n';
    topicResults.forEach((topic, idx) => {
      context += `${idx + 1}. ${topic.topic_title} (${topic.title}, ${topic.date})\n`;
      context += `   Summary: ${topic.comprehensive_summary}\n`;
      context += `   Clips:\n`;
      (topic as any).clips.forEach((clip: any) => {
        context += `   - [${clip.timestamp}] ${clip.speaker}: ${clip.clip_summary}\n`;
      });
      context += '\n';
    });

    context += '\nRELEVANT UTTERANCES:\n\n';
    utteranceResults.forEach((utt, idx) => {
      context += `${idx + 1}. [${utt.timestamp}] ${utt.speaker} (${utt.title}, ${utt.date}): ${utt.text}\n`;
    });

    // 6. Build messages for LLM
    const systemPrompt = `You are a helpful research assistant analyzing podcast transcripts. You have access to research topics (which contain comprehensive summaries and timestamped clips) and individual utterances from the podcasts.

Your task is to:
1. Answer the user's question using the provided context
2. **IMPORTANT**: When citing timestamps, ALWAYS wrap them in square brackets like [12:34] or [1:23:45]. This makes them clickable in the interface.
3. Cite specific speakers and episodes when referencing information
4. Optionally suggest a follow-up search query if it would help the user explore the topic further

If you suggest a follow-up search, format it as:
SUGGESTED_SEARCH: [your suggested query here]

Be conversational, insightful, and helpful. Draw connections between different topics and utterances when relevant. Use markdown formatting for structure (bold, lists, etc.).

Example citation format:
"Joshua discusses this at [48:35] in the 'Love, Hype, and Capitalization' episode..."
"At [51:16], Defender responds to this idea..."`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    conversationHistory.forEach((msg: Message) => {
      messages.push(msg);
    });

    // Add current query with context
    messages.push({
      role: 'user',
      content: `Context:\n${context}\n\nUser question: ${query}`
    });

    // 7. Call LLM
    console.log(`  Calling LLM with ${messages.length} messages (including system and context)...`);
    let content = await callLLM(messages, 4000);

    // 8. Parse suggested search if present
    let suggestedSearch = null;
    const searchMatch = content.match(/SUGGESTED_SEARCH:\s*(.+?)(?:\n|$)/);
    if (searchMatch) {
      suggestedSearch = searchMatch[1].trim();
      // Remove the suggestion from the content
      content = content.replace(/SUGGESTED_SEARCH:\s*.+?(?:\n|$)/, '').trim();
    }

    console.log(`  ✓ Generated response (${content.length} chars)`);
    if (suggestedSearch) {
      console.log(`  ✓ Suggested follow-up: "${suggestedSearch}"`);
    }

    return NextResponse.json({
      response: content,
      suggestedSearch,
      topicResults,
      utteranceResults
    });
  } catch (error: any) {
    console.error('Research chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
