import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth";
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

    if (fs.existsSync(CACHE_PATH)) {
      fs.unlinkSync(CACHE_PATH);
    }

    return NextResponse.json({ message: 'UMAP cache cleared' });
  } catch (error: any) {
    console.error('Error clearing UMAP cache:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
