import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth";
import { getAnalyticsStats } from "@/lib/analytics";
import { NextResponse } from "next/server";

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

    const stats = getAnalyticsStats();

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
