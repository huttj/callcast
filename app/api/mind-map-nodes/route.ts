import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth";
import { generateEmbedding, cosineSimilarity } from "@/lib/ml";
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
    const { titles, searchQuery, similarityCutoff = 0.0 } = body;

    const db = new Database(DB_PATH, { readonly: true });

    let nodes;
    if (titles && titles.length > 0) {
      // Get nodes for specific episode(s)
      const placeholders = titles.map(() => '?').join(',');
      nodes = db.prepare(`
        SELECT video_url, title, date, node_id, parent_id, label, description, timestamps, depth
        FROM mind_map_nodes
        WHERE title IN (${placeholders})
        ORDER BY node_id
      `).all(...titles);
    } else {
      // Get all nodes
      nodes = db.prepare(`
        SELECT video_url, title, date, node_id, parent_id, label, description, timestamps, depth
        FROM mind_map_nodes
        ORDER BY node_id
      `).all();
    }

    // If there's a search query, do semantic filtering
    if (searchQuery && searchQuery.trim()) {
      console.log(`Filtering mind map nodes by query: "${searchQuery}"`);

      // Generate embedding for query
      const queryEmbedding = await generateEmbedding(searchQuery);

      // Generate embeddings for each node's label + description
      const nodeEmbeddings = await Promise.all(
        nodes.map(async (node: any) => {
          const text = `${node.label}. ${node.description || ''}`;
          return await generateEmbedding(text);
        })
      );

      // Calculate similarities
      nodes = nodes.map((node: any, idx: number) => {
        const similarity = cosineSimilarity(queryEmbedding, nodeEmbeddings[idx]);
        return { ...node, similarity };
      });

      // Filter by cutoff
      nodes = nodes.filter((node: any) => node.similarity >= similarityCutoff);

      console.log(`  Filtered to ${nodes.length} nodes (cutoff: ${similarityCutoff})`);
    }

    db.close();

    return NextResponse.json({ nodes });
  } catch (error: any) {
    console.error('Error fetching mind map nodes:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
