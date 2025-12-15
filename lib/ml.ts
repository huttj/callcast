/**
 * Machine learning utilities for embeddings and semantic search
 */

import { pipeline } from '@xenova/transformers';

let extractor: any | null = null;

/**
 * Initialize and cache the embedding model
 */
export async function getEmbeddingModel(): Promise<any> {
  if (!extractor) {
    console.log('Loading embedding model...');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Model loaded successfully!');
  }
  return extractor;
}

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = await getEmbeddingModel();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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
 * Parse binary embedding blob from database to array
 */
export function parseEmbedding(buffer: Buffer): number[] {
  const float32Array = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
  return Array.from(float32Array);
}
