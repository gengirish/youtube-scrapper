import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YouTube Transcript Scraper",
  description:
    "Extract transcripts from any YouTube video. Free, fast, and API-ready for automation workflows like n8n, Zapier, and Make.",
  openGraph: {
    title: "YouTube Transcript Scraper",
    description:
      "Extract transcripts from any YouTube video. API-ready for n8n and automation.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
