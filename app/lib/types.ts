export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface TranscriptResult {
  video_id: string;
  segments: TranscriptSegment[];
  plain_text: string;
  timestamped_text: string;
}

export interface ApiErrorResponse {
  error: string;
}
