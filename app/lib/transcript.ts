const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const CONSENT_COOKIE = "CONSENT=YES+cb.20210328-17-p0.en+FX+688";

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface AvailableLanguage {
  code: string;
  name: string;
  is_generated: boolean;
}

export class TranscriptError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "TranscriptError";
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\n/g, " ")
    .trim();
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: { simpleText?: string; runs?: Array<{ text: string }> };
  kind?: string;
}

function getTrackName(track: CaptionTrack): string {
  if (track.name?.simpleText) return track.name.simpleText;
  if (track.name?.runs) return track.name.runs.map((r) => r.text).join("");
  return track.languageCode;
}

async function fetchVideoPage(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Cookie: CONSENT_COOKIE,
    },
  });

  if (!response.ok) {
    throw new TranscriptError(
      `Failed to fetch YouTube page (HTTP ${response.status}).`,
      502,
    );
  }

  return response.text();
}

function extractJsonFromHtml(
  html: string,
  marker: string,
): Record<string, unknown> | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const assignIdx = html.indexOf("=", idx + marker.length);
  if (assignIdx === -1) return null;

  const jsonStart = html.indexOf("{", assignIdx);
  if (jsonStart === -1) return null;

  let depth = 0;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") depth--;
    if (depth === 0) {
      try {
        return JSON.parse(html.substring(jsonStart, i + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function extractSessionData(html: string): {
  apiKey: string | null;
  visitorData: string | null;
} {
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  const visitorMatch = html.match(/"visitorData":"([^"]+)"/);

  return {
    apiKey: apiKeyMatch?.[1] ?? null,
    visitorData: visitorMatch?.[1] ?? null,
  };
}

async function getCaptionsViaInnerTube(
  videoId: string,
  apiKey: string,
  visitorData: string | null,
): Promise<CaptionTrack[]> {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;

  const context: Record<string, unknown> = {
    client: {
      hl: "en",
      gl: "US",
      clientName: "WEB",
      clientVersion: "2.20250219.01.00",
      userAgent: USER_AGENT,
      ...(visitorData ? { visitorData } : {}),
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Origin: "https://www.youtube.com",
      Referer: `https://www.youtube.com/watch?v=${videoId}`,
      Cookie: CONSENT_COOKIE,
      ...(visitorData ? { "X-Goog-Visitor-Id": visitorData } : {}),
    },
    body: JSON.stringify({ context, videoId }),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    playabilityStatus?: { status?: string };
    captions?: {
      playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
    };
  };

  return (
    data.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  );
}

export async function fetchYouTubeTranscript(
  videoId: string,
  language?: string,
): Promise<{
  segments: TranscriptSegment[];
  languages: AvailableLanguage[];
}> {
  // Step 1: Fetch video page
  const html = await fetchVideoPage(videoId);

  // Check for unavailable video
  if (html.includes('"playabilityStatus":{"status":"ERROR"')) {
    throw new TranscriptError(
      "This video is unavailable or has been removed.",
      404,
    );
  }

  // Step 2: Try extracting captions from ytInitialPlayerResponse in page
  let tracks: CaptionTrack[] = [];

  const playerResponse = extractJsonFromHtml(
    html,
    "ytInitialPlayerResponse",
  );
  if (playerResponse) {
    const captions = playerResponse.captions as Record<string, unknown>;
    const renderer = captions?.playerCaptionsTracklistRenderer as Record<
      string,
      unknown
    >;
    tracks = (renderer?.captionTracks as CaptionTrack[]) || [];
  }

  // Step 3: If page didn't have captions, try InnerTube API with session data
  if (tracks.length === 0) {
    const { apiKey, visitorData } = extractSessionData(html);
    if (apiKey) {
      tracks = await getCaptionsViaInnerTube(videoId, apiKey, visitorData);
    }
  }

  if (tracks.length === 0) {
    throw new TranscriptError(
      "No captions available for this video. The video may not have subtitles enabled.",
      404,
    );
  }

  const languages: AvailableLanguage[] = tracks.map((track) => ({
    code: track.languageCode,
    name: getTrackName(track),
    is_generated: track.kind === "asr",
  }));

  // Step 4: Select the right track
  let selectedTrack: CaptionTrack;
  if (language) {
    const found = tracks.find((t) => t.languageCode === language);
    if (!found) {
      const available = languages.map((l) => l.code).join(", ");
      throw new TranscriptError(
        `Transcript not available in "${language}". Available: ${available}`,
        404,
      );
    }
    selectedTrack = found;
  } else {
    selectedTrack = tracks[0];
  }

  // Step 5: Fetch transcript in JSON3 format
  const separator = selectedTrack.baseUrl.includes("?") ? "&" : "?";
  const transcriptUrl = `${selectedTrack.baseUrl}${separator}fmt=json3`;

  const transcriptResponse = await fetch(transcriptUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Cookie: CONSENT_COOKIE,
    },
  });

  if (!transcriptResponse.ok) {
    throw new TranscriptError(
      "Failed to fetch transcript data from YouTube.",
      502,
    );
  }

  const transcriptData = (await transcriptResponse.json()) as {
    events?: Array<{
      tStartMs?: number;
      dDurationMs?: number;
      segs?: Array<{ utf8: string }>;
    }>;
  };

  // Step 6: Parse events into segments
  const events = transcriptData?.events || [];
  const segments: TranscriptSegment[] = [];

  for (const event of events) {
    if (event.segs) {
      const rawText = event.segs.map((s) => s.utf8 || "").join("");
      const text = decodeHtmlEntities(rawText);
      if (text) {
        segments.push({
          text,
          offset: (event.tStartMs || 0) / 1000,
          duration: (event.dDurationMs || 0) / 1000,
        });
      }
    }
  }

  if (segments.length === 0) {
    throw new TranscriptError(
      "Transcript data was empty for this video.",
      404,
    );
  }

  return { segments, languages };
}
