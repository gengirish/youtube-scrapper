import { NextRequest, NextResponse } from "next/server";
import { extractVideoId } from "@/app/lib/youtube";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") || "btLZQzynfoA";
  const videoId = extractVideoId(url) || url;

  const results: Record<string, unknown> = { videoId };

  // Test 1: Fetch YouTube page
  try {
    const pageRes = await fetch(
      `https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+688",
        },
      },
    );
    const html = await pageRes.text();
    results.pageStatus = pageRes.status;
    results.pageLength = html.length;
    results.hasPlayerResponse = html.includes("ytInitialPlayerResponse");
    results.hasCaptions = html.includes("captionTracks");
    results.hasConsentForm = html.includes("consent.youtube.com");
    results.hasSignIn = html.includes("accounts.google.com/ServiceLogin");

    // Extract a snippet around ytInitialPlayerResponse
    const idx = html.indexOf("ytInitialPlayerResponse");
    if (idx !== -1) {
      results.playerResponseSnippet = html.substring(idx, idx + 200);
    }

    // Check for playability status in page
    const statusMatch = html.match(/"playabilityStatus":\{"status":"([^"]+)"/);
    results.playabilityStatus = statusMatch?.[1] || "not found";

    // Check for captions in page
    const captionsMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (captionsMatch) {
      try {
        const tracks = JSON.parse(captionsMatch[1]);
        results.captionTracksCount = tracks.length;
        results.captionLanguages = tracks.map(
          (t: { languageCode: string }) => t.languageCode,
        );
      } catch {
        results.captionTracksParseError = true;
      }
    }
  } catch (e) {
    results.pageError = e instanceof Error ? e.message : String(e);
  }

  // Test 2: InnerTube API
  try {
    const apiRes = await fetch(
      "https://www.youtube.com/youtubei/v1/player",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          Origin: "https://www.youtube.com",
        },
        body: JSON.stringify({
          context: {
            client: {
              hl: "en",
              gl: "US",
              clientName: "WEB",
              clientVersion: "2.20250219.01.00",
            },
          },
          videoId,
        }),
      },
    );
    const data = (await apiRes.json()) as Record<string, unknown>;
    const ps = data.playabilityStatus as Record<string, unknown>;
    results.innertubeStatus = ps?.status;
    results.innertubeReason = ps?.reason;
    results.innertubeHasCaptions = !!data.captions;
  } catch (e) {
    results.innertubeError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
