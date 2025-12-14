import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'podcasts.db');

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const db = new Database(DB_PATH, { readonly: true });

    // Get list of all episodes with mind maps
    const episodes = db.prepare(`
      SELECT DISTINCT video_url, title, date
      FROM mind_map_nodes
      ORDER BY date DESC
    `).all();

    db.close();

    return NextResponse.json({ episodes });
  } catch (error: any) {
    console.error('Error fetching mind maps:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
