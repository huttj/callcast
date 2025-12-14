import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth";
import { callLLM } from "@/lib/llm";
import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

const CACHE_PATH = path.join(process.cwd(), '.umap-cache.json');

export async function POST() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!fs.existsSync(CACHE_PATH)) {
      return NextResponse.json(
        { error: 'No UMAP data available. Load the map first.' },
        { status: 400 }
      );
    }

    const umapCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    const utterances = umapCache.utterances;

    // Group utterances by cluster
    const clusterMap = new Map<number, any[]>();
    for (const u of utterances) {
      if (u.cluster === -1) continue; // Skip noise
      if (!clusterMap.has(u.cluster)) {
        clusterMap.set(u.cluster, []);
      }
      clusterMap.get(u.cluster)!.push(u);
    }

    console.log(`Naming ${clusterMap.size} clusters in one batch...`);

    // Build a single prompt with all clusters
    const clusterDescriptions: { id: number; text: string }[] = [];

    for (const [clusterId, clusterUtterances] of clusterMap.entries()) {
      // Get diverse representative utterances
      const sampleSize = Math.min(15, clusterUtterances.length);
      const representatives: any[] = [];

      if (clusterUtterances.length <= sampleSize) {
        representatives.push(...clusterUtterances);
      } else {
        // Sort by distance from each other in 2D space to get diverse samples
        const selected = new Set<number>();
        selected.add(0);

        while (selected.size < sampleSize) {
          let maxMinDist = -1;
          let bestIdx = -1;

          for (let i = 0; i < clusterUtterances.length; i++) {
            if (selected.has(i)) continue;

            let minDist = Infinity;
            for (const selIdx of selected) {
              const dx = clusterUtterances[i].x - clusterUtterances[selIdx].x;
              const dy = clusterUtterances[i].y - clusterUtterances[selIdx].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              minDist = Math.min(minDist, dist);
            }

            if (minDist > maxMinDist) {
              maxMinDist = minDist;
              bestIdx = i;
            }
          }

          if (bestIdx !== -1) {
            selected.add(bestIdx);
          } else {
            break;
          }
        }

        for (const idx of selected) {
          representatives.push(clusterUtterances[idx]);
        }
      }

      // Build description for this cluster
      const utteranceTexts = representatives.map((u, idx) =>
        `${idx + 1}. ${u.text}`
      ).join('\n');

      clusterDescriptions.push({
        id: clusterId,
        text: `Cluster ${clusterId} (${clusterUtterances.length} utterances):\n${utteranceTexts}`
      });
    }

    // Build single prompt with all clusters
    const allClustersText = clusterDescriptions.map(c => c.text).join('\n\n---\n\n');

    const prompt = `You are analyzing clusters of semantically similar podcast utterances. For each cluster below, provide a short, descriptive name (2-5 words) that captures the main topic or theme.

${allClustersText}

Respond with a JSON object mapping cluster IDs to names, like this:
{
  "0": "Cluster Name Here",
  "1": "Another Cluster Name",
  ...
}

Only include the JSON object in your response, nothing else.`;

    try {
      const content = await callLLM([{ role: 'user', content: prompt }], 2000);

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse cluster names from LLM response');
      }

      const clusterNames = JSON.parse(jsonMatch[0]);

      // Log results
      for (const [clusterId, name] of Object.entries(clusterNames)) {
        console.log(`Cluster ${clusterId}: "${name}"`);
      }

      // Update cache
      umapCache.clusterNames = clusterNames;
      fs.writeFileSync(CACHE_PATH, JSON.stringify(umapCache));

      return NextResponse.json({ clusterNames });
    } catch (error) {
      console.error('Error calling LLM:', error);

      // Fallback: use generic names
      const fallbackNames: Record<number, string> = {};
      for (const clusterId of clusterMap.keys()) {
        fallbackNames[clusterId] = `Cluster ${clusterId}`;
      }
      return NextResponse.json({ clusterNames: fallbackNames });
    }
  } catch (error: any) {
    console.error('Error naming clusters:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
