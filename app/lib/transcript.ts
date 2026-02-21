const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const CONSENT_COOKIE =
  "CONSENT=PENDING+999; SOCS=CAESEwgDEgk2NjU1NjU2NTcaAmVuIAEaBgiA_LyuBg";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: { simpleText: string };
  kind?: string;
}

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

function extractPlayerResponse(html: string): Record<string, unknown> {
  const marker = "ytInitialPlayerResponse";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    throw new TranscriptError(
      "Could not find player response in page. The video may be unavailable.",
      404,
    );
  }

  const assignIdx = html.indexOf("=", startIdx);
  const jsonStart = html.indexOf("{", assignIdx);
  if (jsonStart === -1) {
    throw new TranscriptError("Failed to parse YouTube page.", 500);
  }

  let depth = 0;
  let jsonEnd = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") depth--;
    if (depth === 0) {
      jsonEnd = i + 1;
      break;
    }
  }

  const jsonStr = html.substring(jsonStart, jsonEnd);
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new TranscriptError("Failed to parse player response JSON.", 500);
  }
}

function getCaptionTracks(
  playerResponse: Record<string, unknown>,
): CaptionTrack[] {
  const captions = playerResponse?.captions as Record<string, unknown>;
  if (!captions) {
    throw new TranscriptError(
      "No captions available for this video. The video may not have subtitles enabled.",
      404,
    );
  }

  const renderer = captions?.playerCaptionsTracklistRenderer as Record<
    string,
    unknown
  >;
  const tracks = renderer?.captionTracks as CaptionTrack[];

  if (!tracks || tracks.length === 0) {
    throw new TranscriptError(
      "No caption tracks found for this video.",
      404,
    );
  }

  return tracks;
}

export async function fetchYouTubeTranscript(
  videoId: string,
  language?: string,
): Promise<{
  segments: TranscriptSegment[];
  languages: AvailableLanguage[];
}> {
  // Step 1: Fetch the video page with consent cookies
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
  const pageResponse = await fetch(pageUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: CONSENT_COOKIE,
    },
  });

  if (!pageResponse.ok) {
    throw new TranscriptError(
      `Failed to fetch YouTube page (HTTP ${pageResponse.status}).`,
      pageResponse.status >= 500 ? 502 : 404,
    );
  }

  const html = await pageResponse.text();

  // Check for unavailable video
  if (
    html.includes('"playabilityStatus":{"status":"ERROR"') ||
    html.includes('"playabilityStatus":{"status":"UNPLAYABLE"')
  ) {
    throw new TranscriptError(
      "This video is unavailable or has been removed.",
      404,
    );
  }

  // Step 2: Extract player response
  const playerResponse = extractPlayerResponse(html);

  // Step 3: Get caption tracks
  const captionTracks = getCaptionTracks(playerResponse);

  const languages: AvailableLanguage[] = captionTracks.map((track) => ({
    code: track.languageCode,
    name: track.name?.simpleText || track.languageCode,
    is_generated: track.kind === "asr",
  }));

  // Step 4: Select the right track
  let selectedTrack: CaptionTrack;
  if (language) {
    const found = captionTracks.find((t) => t.languageCode === language);
    if (!found) {
      const available = languages.map((l) => l.code).join(", ");
      throw new TranscriptError(
        `Transcript not available in "${language}". Available languages: ${available}`,
        404,
      );
    }
    selectedTrack = found;
  } else {
    selectedTrack = captionTracks[0];
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
