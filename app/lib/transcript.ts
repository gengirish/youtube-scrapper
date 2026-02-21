const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

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
    .trim();
}

// --- Strategy 1: Direct YouTube (works from non-cloud IPs) ---

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

async function tryDirectYouTube(
  videoId: string,
  language?: string,
): Promise<{
  segments: TranscriptSegment[];
  languages: AvailableLanguage[];
} | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+688",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;
    const html = await response.text();

    if (html.includes('"status":"LOGIN_REQUIRED"')) return null;
    if (html.includes('"status":"ERROR"')) return null;

    const captionsMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (!captionsMatch) return null;

    let tracks: CaptionTrack[];
    try {
      tracks = JSON.parse(captionsMatch[1]);
    } catch {
      return null;
    }
    if (tracks.length === 0) return null;

    const languages = tracks.map((t) => ({
      code: t.languageCode,
      name: getTrackName(t),
      is_generated: t.kind === "asr",
    }));

    const selected = language
      ? tracks.find((t) => t.languageCode === language) || tracks[0]
      : tracks[0];

    const sep = selected.baseUrl.includes("?") ? "&" : "?";
    const transcriptRes = await fetch(`${selected.baseUrl}${sep}fmt=json3`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (!transcriptRes.ok) return null;
    const segments = parseJson3(await transcriptRes.json());
    if (segments.length === 0) return null;

    return { segments, languages };
  } catch {
    return null;
  }
}

// --- Strategy 2: Supadata API (works from cloud, needs API key) ---

interface SupadataContent {
  text: string;
  offset: number;
  duration: number;
  lang: string;
}

async function trySupadata(
  videoId: string,
  language?: string,
): Promise<{
  segments: TranscriptSegment[];
  languages: AvailableLanguage[];
} | null> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
    if (language) params.set("lang", language);

    const response = await fetch(
      `https://api.supadata.ai/v1/transcript?${params.toString()}`,
      {
        headers: {
          "x-api-key": apiKey,
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (response.status === 404) return null;
      if (response.status === 401 || response.status === 403) {
        throw new TranscriptError(
          "Supadata API key is invalid. Check your SUPADATA_API_KEY environment variable.",
          500,
        );
      }
      throw new TranscriptError(
        errorData.message || `Supadata API error (HTTP ${response.status})`,
        response.status,
      );
    }

    const data = (await response.json()) as {
      content?: SupadataContent[];
      lang?: string;
    };

    const content = data.content;
    if (!content || content.length === 0) return null;

    const detectedLang = data.lang || content[0]?.lang || "en";

    const segments: TranscriptSegment[] = content.map((item) => ({
      text: decodeHtmlEntities(item.text),
      offset: item.offset / 1000,
      duration: item.duration / 1000,
    }));

    const languages: AvailableLanguage[] = [
      {
        code: detectedLang,
        name: detectedLang,
        is_generated: false,
      },
    ];

    return { segments, languages };
  } catch (e) {
    if (e instanceof TranscriptError) throw e;
    return null;
  }
}

// --- JSON3 parser ---

function parseJson3(
  data: {
    events?: Array<{
      tStartMs?: number;
      dDurationMs?: number;
      segs?: Array<{ utf8: string }>;
    }>;
  },
): TranscriptSegment[] {
  const events = data?.events || [];
  const segments: TranscriptSegment[] = [];

  for (const event of events) {
    if (event.segs) {
      const rawText = event.segs.map((s) => s.utf8 || "").join("");
      const text = decodeHtmlEntities(rawText).replace(/\n/g, " ").trim();
      if (text) {
        segments.push({
          text,
          offset: (event.tStartMs || 0) / 1000,
          duration: (event.dDurationMs || 0) / 1000,
        });
      }
    }
  }

  return segments;
}

// --- Main fetch function ---

export async function fetchYouTubeTranscript(
  videoId: string,
  language?: string,
): Promise<{
  segments: TranscriptSegment[];
  languages: AvailableLanguage[];
}> {
  // Strategy 1: Direct YouTube (works from non-cloud IPs)
  const directResult = await tryDirectYouTube(videoId, language);
  if (directResult && directResult.segments.length > 0) {
    return directResult;
  }

  // Strategy 2: Supadata API (works from cloud, needs API key)
  const supadataResult = await trySupadata(videoId, language);
  if (supadataResult && supadataResult.segments.length > 0) {
    return supadataResult;
  }

  // All strategies failed
  const hasApiKey = !!process.env.SUPADATA_API_KEY;
  if (!hasApiKey) {
    throw new TranscriptError(
      "YouTube is blocking requests from this server. To fix this, add a free SUPADATA_API_KEY environment variable. Get one at https://supadata.ai (100 free requests, no credit card).",
      503,
    );
  }

  throw new TranscriptError(
    "Could not fetch transcript. The video may not have captions enabled, or YouTube is blocking requests.",
    404,
  );
}
