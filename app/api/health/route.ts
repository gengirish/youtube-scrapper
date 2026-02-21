import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "youtube-transcript-scraper",
    timestamp: new Date().toISOString(),
  });
}
