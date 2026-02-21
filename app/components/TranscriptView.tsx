"use client";

import { useState } from "react";
import { Copy, Download, Clock, FileText, Check } from "lucide-react";
import type { TranscriptResult } from "../lib/types";

interface TranscriptViewProps {
  result: TranscriptResult;
}

export default function TranscriptView({ result }: TranscriptViewProps) {
  const [viewMode, setViewMode] = useState<"timestamped" | "plain">(
    "timestamped",
  );
  const [copied, setCopied] = useState(false);

  const displayText =
    viewMode === "timestamped" ? result.timestamped_text : result.plain_text;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([displayText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${result.video_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 space-y-4 animate-fade-in">
      {/* Video info */}
      <div className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <img
          src={`https://img.youtube.com/vi/${result.video_id}/mqdefault.jpg`}
          alt="Video thumbnail"
          className="w-36 h-auto rounded-lg"
        />
        <div>
          <p className="text-sm text-zinc-500">Video ID</p>
          <p className="text-lg font-mono text-zinc-100">{result.video_id}</p>
          <p className="text-sm text-zinc-500 mt-1">
            {result.segments.length} segments extracted
          </p>
          <a
            href={`https://youtube.com/watch?v=${result.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-red-400 hover:text-red-300 mt-1 inline-block transition-colors"
          >
            Watch on YouTube &rarr;
          </a>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode("timestamped")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
              viewMode === "timestamped"
                ? "bg-red-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            Timestamped
          </button>
          <button
            onClick={() => setViewMode("plain")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
              viewMode === "plain"
                ? "bg-red-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            Plain Text
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-all cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download .txt
          </button>
        </div>
      </div>

      {/* Transcript content */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 max-h-[600px] overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 font-sans">
          {displayText}
        </pre>
      </div>
    </div>
  );
}
