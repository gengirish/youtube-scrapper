"use client";

import { useState } from "react";
import { Code, ChevronDown, ChevronUp, Webhook, Copy, Check } from "lucide-react";

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group mt-3 bg-zinc-950 rounded-lg">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-zinc-400" />
        )}
      </button>
      <pre className="p-4 text-xs text-zinc-400 overflow-x-auto">{children}</pre>
    </div>
  );
}

function Endpoint({
  method,
  path,
  description,
  children,
  color,
}: {
  method: string;
  path: string;
  description: string;
  children: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-500/20 text-green-400",
    blue: "bg-blue-500/20 text-blue-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`px-2 py-0.5 ${colorClasses[color]} text-xs font-mono rounded`}
        >
          {method}
        </span>
        <code className="text-sm text-zinc-300">{path}</code>
      </div>
      <p className="text-sm text-zinc-400 mb-3">{description}</p>
      {children}
    </div>
  );
}

export default function ApiDocs() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-16 border-t border-zinc-800 pt-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left group cursor-pointer"
      >
        <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200 transition-colors">
          <Webhook className="w-5 h-5" />
          <h2 className="text-lg font-semibold">API Documentation</h2>
          <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">
            n8n / Zapier / Make
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-zinc-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="mt-6 space-y-6 animate-fade-in">
          <Endpoint
            method="GET"
            path="/api/health"
            description="Health check endpoint. Use in n8n to verify the service is running."
            color="green"
          >
            <CodeBlock>{`// Response
{ "status": "ok", "service": "youtube-transcript-scraper", "timestamp": "..." }`}</CodeBlock>
          </Endpoint>

          <Endpoint
            method="GET"
            path="/api/transcript?url=YOUTUBE_URL&language=en"
            description="Fetch transcript via query parameters. Best for n8n HTTP Request node."
            color="blue"
          >
            <div className="space-y-2 mb-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Parameters
              </p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-zinc-800">
                  <tr>
                    <td className="py-2 text-zinc-300 font-mono">url</td>
                    <td className="py-2 text-red-400 text-xs">required</td>
                    <td className="py-2 text-zinc-400">
                      YouTube URL or video ID
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-zinc-300 font-mono">language</td>
                    <td className="py-2 text-zinc-500 text-xs">optional</td>
                    <td className="py-2 text-zinc-400">
                      Language code (en, fr, es, etc.)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <CodeBlock>{`// curl example
curl "https://your-app.vercel.app/api/transcript?url=https://youtu.be/btLZQzynfoA"

// n8n HTTP Request Node
// Method: GET
// URL: https://your-app.vercel.app/api/transcript
// Query Parameters:
//   url = {{ $json.youtube_url }}`}</CodeBlock>
          </Endpoint>

          <Endpoint
            method="POST"
            path="/api/transcript"
            description="Fetch transcript via JSON body. Best for webhook-based workflows."
            color="yellow"
          >
            <CodeBlock>{`// Request body
{
  "url": "https://youtu.be/btLZQzynfoA",
  "language": "en"
}

// Response
{
  "video_id": "btLZQzynfoA",
  "segments": [
    { "text": "Hello everyone", "offset": 0.0, "duration": 4.52 }
  ],
  "plain_text": "Full transcript as plain text...",
  "timestamped_text": "[0:00] Full transcript with timestamps..."
}`}</CodeBlock>
          </Endpoint>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Code className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-300">
                n8n Workflow Example
              </span>
            </div>
            <CodeBlock>{`// Step 1: HTTP Request Node
// Method: GET
// URL: https://your-app.vercel.app/api/transcript
// Query: url = {{ $json.youtube_url }}

// Step 2: Access response data in next nodes
// Plain text:     {{ $json.plain_text }}
// Timestamped:    {{ $json.timestamped_text }}
// Segments array: {{ $json.segments }}
// Video ID:       {{ $json.video_id }}
// Segment count:  {{ $json.segments.length }}`}</CodeBlock>
          </div>
        </div>
      )}
    </div>
  );
}
