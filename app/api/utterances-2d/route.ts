import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth";
import { parseEmbedding } from "@/lib/ml";
import { NextRequest, NextResponse } from "next/server";
import Database from 'better-sqlite3';
import path from 'path';
import { UMAP } from 'umap-js';
import { kmeans } from 'ml-kmeans';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), '..', 'podcasts.db');
const CACHE_PATH = path.join(process.cwd(), '.umap-cache.json');

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const numClusters = parseInt(searchParams.get('numClusters') || '20');
    const forceRecompute = searchParams.get('forceRecompute') === 'true';

    // Try to return cache if available
    if (!forceRecompute && fs.existsSync(CACHE_PATH)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
      if (cache.numClusters === numClusters) {
        console.log('Returning cached UMAP data');
        return NextResponse.json(cache);
      }
    }

    console.log('Computing UMAP 2D projection...');
    const db = new Database(DB_PATH, { readonly: true });

    // Get all utterances with embeddings
    const utterances = db.prepare(`
      SELECT id, text, speaker, timestamp, title, date, video_url, embedding
      FROM utterances
      WHERE embedding IS NOT NULL
      LIMIT 5000
    `).all() as Array<{
      id: number;
      text: string;
      speaker: string;
      timestamp: string;
      title: string;
      date: string;
      video_url: string;
      embedding: Buffer;
    }>;

    db.close();

    if (utterances.length === 0) {
      return NextResponse.json({ utterances: [], coordinates: [] });
    }

    console.log(`Processing ${utterances.length} utterances...`);

    // Parse embeddings
    const embeddings = utterances.map(u => parseEmbedding(u.embedding));

    console.log(`Parsed ${embeddings.length} embeddings, dimension: ${embeddings[0]?.length}`);

    // Run UMAP
    console.log('Running UMAP dimensionality reduction...');
    const nNeighbors = Math.min(15, utterances.length - 1);
    const umap = new UMAP({
      nComponents: 2,
      nNeighbors,
      minDist: 0.1,
      random: () => Math.random(),
    });

    const nEpochs = umap.initializeFit(embeddings);
    for (let i = 0; i < nEpochs; i++) {
      umap.step();
      if (i % 50 === 0) {
        console.log(`UMAP progress: ${Math.round((i / nEpochs) * 100)}%`);
      }
    }

    const coordinates = umap.getEmbedding();

    // Run K-means clustering
    console.log(`Running K-means clustering with k=${numClusters}...`);
    const kmeansResult = kmeans(coordinates, numClusters, {
      initialization: 'kmeans++',
      maxIterations: 100
    });

    const clusterLabels = kmeansResult.clusters;
    const uniqueClusters = new Set(clusterLabels);

    console.log(`Created ${uniqueClusters.size} clusters`);

    // Prepare response
    const result = {
      utterances: utterances.map((u, idx) => ({
        id: u.id,
        text: u.text,
        speaker: u.speaker,
        timestamp: u.timestamp,
        title: u.title,
        date: u.date,
        video_url: u.video_url,
        x: coordinates[idx][0],
        y: coordinates[idx][1],
        cluster: clusterLabels[idx],
      })),
      clusterCount: new Set(clusterLabels).size,
      clusterNames: {},
      numClusters,
    };

    // Cache the result
    fs.writeFileSync(CACHE_PATH, JSON.stringify(result));
    console.log('UMAP and clustering computation complete');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error computing UMAP:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
