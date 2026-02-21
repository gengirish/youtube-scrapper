const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const INNERTUBE_BASE_URL = "https://www.youtube.com/youtubei/v1";

const CLIENT_CONFIGS = [
  {
    name: "WEB_EMBEDDED",
    context: {
      client: {
        hl: "en",
        gl: "US",
        clientName: "WEB_EMBEDDED_PLAYER",
        clientVersion: "1.20250219.01.00",
      },
      thirdParty: { embedUrl: "https://www.youtube.com/" },
    },
  },
  {
    name: "TV_EMBEDDED",
    context: {
      client: {
        hl: "en",
        gl: "US",
        clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
        clientVersion: "2.0",
      },
      thirdParty: { embedUrl: "https://www.youtube.com/" },
    },
  },
  {
    name: "WEB",
    context: {
      client: {
        hl: "en",
        gl: "US",
        clientName: "WEB",
        clientVersion: "2.20250219.01.00",
      },
    },
  },
];

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

interface PlayerApiResponse {
  playabilityStatus?: { status?: string; reason?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

async function tryPlayerRequest(
  videoId: string,
  clientConfig: (typeof CLIENT_CONFIGS)[number],
): Promise<PlayerApiResponse | null> {
  try {
    const response = await fetch(`${INNERTUBE_BASE_URL}/player`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        Origin: "https://www.youtube.com",
        Referer: "https://www.youtube.com/",
      },
      body: JSON.stringify({
        context: clientConfig.context,
        videoId,
      }),
    });

    if (!response.ok) return null;
    return (await response.json()) as PlayerApiResponse;
  } catch {
    return null;
  }
}

async function getPlayerCaptions(
  videoId: string,
): Promise<{ tracks: CaptionTrack[] }> {
  let lastStatus = "UNKNOWN";
  let lastReason = "";

  for (const clientConfig of CLIENT_CONFIGS) {
    const data = await tryPlayerRequest(videoId, clientConfig);
    if (!data) continue;

    const status = data.playabilityStatus?.status || "UNKNOWN";

    if (status === "ERROR" || status === "UNPLAYABLE") {
      throw new TranscriptError(
        data.playabilityStatus?.reason ||
          "This video is unavailable or has been removed.",
        404,
      );
    }

    lastStatus = status;
    lastReason = data.playabilityStatus?.reason || "";

    const tracks =
      data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    if (tracks.length > 0) {
      return { tracks };
    }

    if (status === "OK" && tracks.length === 0) {
      throw new TranscriptError(
        "No captions available for this video. The video may not have subtitles enabled.",
        404,
      );
    }
  }

  if (lastStatus === "LOGIN_REQUIRED") {
    throw new TranscriptError(
      lastReason || "YouTube requires authentication for this request. Please try again.",
      403,
    );
  }

  throw new TranscriptError(
    "Could not retrieve captions from YouTube. All client strategies exhausted.",
    502,
  );
}

export async function fetchYouTubeTranscript(
  videoId: string,
  language?: string,
): Promise<{
  segments: TranscriptSegment[];
  languages: AvailableLanguage[];
}> {
  // Step 1: Get caption tracks via InnerTube API
  const { tracks } = await getPlayerCaptions(videoId);

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

  // Step 2: Select the right track
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

  // Step 3: Fetch transcript in JSON3 format
  const separator = selectedTrack.baseUrl.includes("?") ? "&" : "?";
  const transcriptUrl = `${selectedTrack.baseUrl}${separator}fmt=json3`;

  const transcriptResponse = await fetch(transcriptUrl, {
    headers: { "User-Agent": USER_AGENT },
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

  // Step 4: Parse events into segments
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
