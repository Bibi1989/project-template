import { NextResponse } from "next/server";

import { checkDatabase } from "@/services/health/queries/check-database";

export async function GET() {
  try {
    const result = await checkDatabase();
    const status = result.status === "OK" ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", timestamp: new Date().toISOString() }, { status: 500 });
  }
}
