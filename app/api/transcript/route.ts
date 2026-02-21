import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, formatTime } from "@/app/lib/youtube";
import {
  fetchYouTubeTranscript,
  TranscriptError,
} from "@/app/lib/transcript";

async function handleTranscript(url: string, language?: string) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "Invalid YouTube URL or video ID." },
      { status: 400 },
    );
  }

  try {
    const { segments, languages } = await fetchYouTubeTranscript(
      videoId,
      language,
    );

    const mapped = segments.map((s) => ({
      text: s.text,
      offset: s.offset,
      duration: s.duration,
    }));

    const plainText = mapped.map((s) => s.text).join("\n");
    const timestampedText = mapped
      .map((s) => `[${formatTime(s.offset)}] ${s.text}`)
      .join("\n");

    return NextResponse.json({
      video_id: videoId,
      languages,
      segments: mapped,
      plain_text: plainText,
      timestamped_text: timestampedText,
    });
  } catch (error: unknown) {
    if (error instanceof TranscriptError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/transcript?url=...&language=... — for n8n, Zapier, Make, curl
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const language = request.nextUrl.searchParams.get("language");

  if (!url) {
    return NextResponse.json(
      {
        error: "Missing required query parameter: url",
        usage:
          "GET /api/transcript?url=https://youtu.be/VIDEO_ID&language=en",
      },
      { status: 400 },
    );
  }

  return handleTranscript(url, language || undefined);
}

// POST /api/transcript — for frontend and webhook workflows
export async function POST(request: NextRequest) {
  let body: { url?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { url, language } = body;
  if (!url) {
    return NextResponse.json(
      { error: 'Missing required field: "url"' },
      { status: 400 },
    );
  }

  return handleTranscript(url, language || undefined);
}
