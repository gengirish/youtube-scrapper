"use client";

import { useState } from "react";
import { FileText, Zap } from "lucide-react";
import UrlInput from "./components/UrlInput";
import TranscriptView from "./components/TranscriptView";
import ErrorMessage from "./components/ErrorMessage";
import ApiDocs from "./components/ApiDocs";
import type { TranscriptResult } from "./lib/types";

export default function Home() {
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async (url: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch transcript");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              YouTube Transcript
              <span className="text-red-500"> Scraper</span>
            </h1>
          </div>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Extract transcripts from any YouTube video. Free, fast, and
            API-ready for automation workflows.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-zinc-400">
              <Zap className="w-3 h-3 text-yellow-500" />
              n8n / Zapier / Make compatible
            </span>
          </div>
        </div>

        {/* URL Input */}
        <UrlInput onSubmit={handleFetch} loading={loading} />

        {/* Error */}
        {error && <ErrorMessage message={error} />}

        {/* Results */}
        {result && <TranscriptView result={result} />}

        {/* API Docs */}
        <ApiDocs />

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800 text-center text-sm text-zinc-600">
          Built for automation. Open API for n8n, Zapier, Make, and any HTTP
          client.
        </footer>
      </div>
    </main>
  );
}
