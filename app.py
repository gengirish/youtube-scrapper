import re
import json
from flask import Flask, request, jsonify, send_from_directory
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

app = Flask(__name__, static_folder="static")


def extract_video_id(url_or_id: str) -> str | None:
    """Extract YouTube video ID from various URL formats or a raw ID."""
    patterns = [
        r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/watch\?.*v=)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", url_or_id):
        return url_or_id
    return None


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/transcript", methods=["POST"])
def get_transcript():
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()

    if not url:
        return jsonify({"error": "Please provide a YouTube URL or video ID."}), 400

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Could not extract a valid video ID from the input."}), 400

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        available_langs = []
        for t in transcript_list:
            available_langs.append({
                "code": t.language_code,
                "name": t.language,
                "is_generated": t.is_generated,
            })

        lang = data.get("language")
        if lang:
            transcript = transcript_list.find_transcript([lang]).fetch()
        else:
            transcript = transcript_list.find_transcript(
                [l["code"] for l in available_langs]
            ).fetch()

        segments = [
            {
                "start": round(seg.start, 2),
                "duration": round(seg.duration, 2),
                "text": seg.text,
            }
            for seg in transcript
        ]

        plain_text = "\n".join(seg["text"] for seg in segments)

        timestamped_text = "\n".join(
            f"[{_format_time(seg['start'])}] {seg['text']}" for seg in segments
        )

        return jsonify({
            "video_id": video_id,
            "languages": available_langs,
            "segments": segments,
            "plain_text": plain_text,
            "timestamped_text": timestamped_text,
        })

    except TranscriptsDisabled:
        return jsonify({"error": "Transcripts are disabled for this video."}), 404
    except NoTranscriptFound:
        return jsonify({"error": "No transcript found for this video."}), 404
    except VideoUnavailable:
        return jsonify({"error": "This video is unavailable."}), 404
    except Exception as e:
        return jsonify({"error": f"Something went wrong: {str(e)}"}), 500


def _format_time(seconds: float) -> str:
    mins, secs = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    if hours:
        return f"{hours}:{mins:02d}:{secs:02d}"
    return f"{mins}:{secs:02d}"


if __name__ == "__main__":
    app.run(debug=True, port=5000)
