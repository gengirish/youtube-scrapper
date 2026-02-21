# YouTube Transcript Scraper — MVP Plan of Action

## Overview

Build a clean, modern web application that extracts transcripts from any YouTube video. Users paste a YouTube URL, and the app fetches and displays the full transcript with timestamps, copy/download options, and language selection.

**Live URL target:** `youtube-scrapper.vercel.app`

---

## Current State

| Item | Status |
|------|--------|
| Python/Flask prototype (`app.py`) | Exists but not Vercel-compatible |
| Frontend (`static/`) | Empty — no UI built yet |
| Deployment | None |

### Why Rebuild?

The existing Flask app uses `youtube-transcript-api` (Python). Vercel's serverless functions work best with **Node.js/Next.js**. Rebuilding in Next.js gives us:

- Native Vercel deployment (zero config)
- Server-side API routes (no separate backend)
- React-based modern UI with Tailwind CSS
- Better cold-start performance on serverless

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 15** (App Router) | Best Vercel integration, SSR, API routes |
| Language | **TypeScript** | Type safety, better DX |
| Styling | **Tailwind CSS v4** | Rapid UI development, modern look |
| Transcript Lib | **youtube-transcript-plus** | Lightweight (0 deps), maintained, TS support |
| Icons | **Lucide React** | Clean icon set |
| Deployment | **Vercel** | Free tier, instant deploys, edge network |

---

## MVP Features (v1.0)

### Core Features
1. **URL Input** — Paste any YouTube URL format (youtu.be, youtube.com/watch, /embed, /shorts)
2. **Transcript Extraction** — Fetch full transcript via server-side API route
3. **Timestamped View** — Display transcript segments with clickable timestamps
4. **Plain Text View** — Toggle between timestamped and plain text modes
5. **Copy to Clipboard** — One-click copy of full transcript
6. **Download** — Export transcript as `.txt` file
7. **Language Selection** — Show available languages, let user pick
8. **Video Preview** — Embed YouTube thumbnail/title for confirmation
9. **Error Handling** — Graceful errors for disabled transcripts, invalid URLs, etc.
10. **Responsive Design** — Works on mobile, tablet, desktop

### Nice-to-Have (Post-MVP)
- SRT/VTT file download
- Search within transcript
- Share transcript via link
- API key for programmatic access
- Dark/light mode toggle
- Transcript summary via AI

---

## Application Architecture

```
youtube-scrapper/
├── app/
│   ├── layout.tsx            # Root layout (fonts, metadata, global styles)
│   ├── page.tsx              # Home page — URL input + transcript display
│   ├── api/
│   │   └── transcript/
│   │       └── route.ts      # POST /api/transcript — server-side transcript fetch
│   ├── components/
│   │   ├── Header.tsx        # App header/branding
│   │   ├── UrlInput.tsx      # YouTube URL input form
│   │   ├── TranscriptView.tsx # Transcript display (timestamped + plain)
│   │   ├── VideoPreview.tsx  # YouTube video thumbnail + title
│   │   ├── LanguageSelect.tsx # Language dropdown
│   │   ├── ActionBar.tsx     # Copy, Download buttons
│   │   └── ErrorMessage.tsx  # Error display component
│   └── lib/
│       ├── youtube.ts        # Video ID extraction, YouTube helpers
│       └── types.ts          # TypeScript interfaces
├── public/
│   └── og-image.png          # Open Graph image for social sharing
├── tailwind.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## API Design

### `POST /api/transcript`

**Request:**
```json
{
  "url": "https://youtu.be/btLZQzynfoA",
  "language": "en"           // optional
}
```

**Response (200):**
```json
{
  "video_id": "btLZQzynfoA",
  "title": "Video Title",
  "languages": [
    { "code": "en", "name": "English", "is_generated": true }
  ],
  "segments": [
    { "start": 0.0, "duration": 4.52, "text": "Hello everyone" }
  ],
  "plain_text": "Hello everyone\n...",
  "timestamped_text": "[0:00] Hello everyone\n..."
}
```

**Error Response (4xx/5xx):**
```json
{
  "error": "Transcripts are disabled for this video."
}
```

---

## UI Design Concept

```
┌─────────────────────────────────────────────────┐
│  📝 YouTube Transcript Scraper                  │
│  Extract transcripts from any YouTube video     │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────┐ ┌────────┐ │
│  │ Paste YouTube URL here...       │ │ Fetch  │ │
│  └─────────────────────────────────┘ └────────┘ │
│                                                 │
│  ┌──────────────┐  ┌──────┐ ┌──────┐ ┌───────┐ │
│  │ Language: EN ▼│  │ Copy │ │ .TXT │ │Toggle │ │
│  └──────────────┘  └──────┘ └──────┘ └───────┘ │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ [0:00]  Hello everyone, welcome to...       ││
│  │ [0:04]  today we're going to talk about...  ││
│  │ [0:09]  the first thing I want to mention.. ││
│  │ [0:15]  ...                                 ││
│  │                                             ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

- **Color Palette:** Dark background (#0a0a0a), accent red (#FF0000 — YouTube red), white text
- **Font:** Inter (clean, modern)
- **Style:** Minimalist, glassmorphism cards, subtle animations

---

## Step-by-Step Implementation Plan

### Phase 1: Project Setup
- [ ] Initialize Next.js 15 project with TypeScript + Tailwind CSS
- [ ] Install dependencies (`youtube-transcript-plus`, `lucide-react`)
- [ ] Set up project structure (folders, config files)
- [ ] Configure `next.config.ts` for production

### Phase 2: Backend API Route
- [ ] Create `app/lib/youtube.ts` — video ID extraction utility
- [ ] Create `app/lib/types.ts` — TypeScript interfaces
- [ ] Create `POST /api/transcript` route handler
- [ ] Handle all error cases (disabled, not found, unavailable)
- [ ] Test with the provided URL: `btLZQzynfoA`

### Phase 3: Frontend UI
- [ ] Build `Header` component (branding)
- [ ] Build `UrlInput` component (form with validation)
- [ ] Build `VideoPreview` component (thumbnail display)
- [ ] Build `TranscriptView` component (timestamped + plain views)
- [ ] Build `LanguageSelect` dropdown
- [ ] Build `ActionBar` (copy + download buttons)
- [ ] Build `ErrorMessage` component
- [ ] Wire everything together in `page.tsx`

### Phase 4: Polish & UX
- [ ] Add loading states (skeleton/spinner)
- [ ] Add toast notifications for copy success
- [ ] Responsive design testing
- [ ] SEO metadata (title, description, OG image)
- [ ] Favicon

### Phase 5: Deployment
- [ ] Initialize Git repository
- [ ] Create `.gitignore`
- [ ] Push to GitHub
- [ ] Connect to Vercel
- [ ] Deploy and verify

---

## Deployment Checklist

- [ ] `next.config.ts` — no build errors
- [ ] Environment variables — none needed (no API key required)
- [ ] Build test — `npm run build` passes locally
- [ ] Vercel project linked via `vercel` CLI or GitHub integration
- [ ] Custom domain (optional)

---

## Estimated Timeline

| Phase | Time |
|-------|------|
| Phase 1: Setup | ~5 min |
| Phase 2: API Route | ~10 min |
| Phase 3: Frontend UI | ~20 min |
| Phase 4: Polish | ~10 min |
| Phase 5: Deploy | ~5 min |
| **Total** | **~50 min** |

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| `youtube-transcript-plus` breaks (YouTube API change) | High | Fallback to direct InnerTube API call |
| Rate limiting by YouTube | Medium | Add caching layer, rate limit API route |
| Videos with no captions | Low | Clear error message to user |
| Large transcripts (2hr+ videos) | Low | Pagination or virtual scrolling |

---

## Success Criteria

- [ ] User can paste any YouTube URL and get the transcript in < 3 seconds
- [ ] Copy and download work flawlessly
- [ ] App is live on Vercel with a public URL
- [ ] Mobile-responsive design
- [ ] Clean error handling for all edge cases

---

*Ready to build? Let's go.* 🚀
