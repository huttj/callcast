import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generateEmbedding } from "@/lib/ml";
import { NextRequest, NextResponse } from "next/server";

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
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const embedding = await generateEmbedding(text);

    return NextResponse.json({ embedding });
  } catch (error: any) {
    console.error('Embedding error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
