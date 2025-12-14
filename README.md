# Podcast Research Tool - Next.js App

A Next.js application for searching and analyzing podcast transcripts with AI-powered semantic search and chat.

## Features

- **Twitter OAuth Authentication** - Users must sign in to access the app
- **Semantic Search** - Find relevant podcast topics using embeddings
- **AI Chat Interface** - Ask questions and get AI-generated responses with citations
- **Research Topics** - Browse comprehensive summaries of podcast discussions
- **Analytics Tracking** - Track user searches and queries
- **Protected Routes** - All routes require authentication via middleware

## Tech Stack

- **Next.js 15** - React framework with App Router
- **NextAuth v5** - Authentication with Twitter OAuth 2.0
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Styling
- **Transformers.js** - Client-side ML for embeddings
- **Better-SQLite3** - Database access
- **OpenRouter** - LLM API for chat

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Twitter Developer account with OAuth 2.0 app
- OpenRouter API key
- SQLite database (`podcasts.db`) with podcast data

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your credentials
```

### Environment Variables

```env
# Twitter OAuth
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# NextAuth Secret
AUTH_SECRET=your_generated_secret

# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_key
```

Generate `AUTH_SECRET` with:
```bash
openssl rand -base64 32
```

### Database Setup

Place your `podcasts.db` file in the parent directory (`../podcasts.db` relative to the Next.js app).

The database should have these tables:
- `users` - User authentication data
- `analytics_events` - Usage tracking
- `research_topics` - Podcast topic summaries
- `research_clips` - Timestamped clips
- `utterances` - Individual speaker utterances with embeddings

See `../AUTH_SETUP.md` for the schema.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm run start
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed Vercel deployment instructions.

### Quick Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables in Vercel dashboard and update Twitter OAuth callback URLs.

## Project Structure

```
nextjs-app/
├── app/
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth routes
│   │   ├── embed/         # Embedding generation
│   │   ├── search-research/ # Search topics
│   │   ├── research-chat/ # AI chat
│   │   └── analytics/     # Analytics stats
│   ├── login/             # Login page
│   ├── page.tsx           # Main application
│   └── layout.tsx         # Root layout
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── ml.ts              # ML utilities (embeddings, similarity)
│   ├── analytics.ts       # Analytics tracking
│   └── llm.ts             # LLM API calls
├── middleware.ts          # Auth middleware (protects all routes)
└── vercel.json            # Vercel configuration
```

## Authentication Flow

1. User visits any route
2. Middleware checks for session
3. If not authenticated, redirect to `/login`
4. User clicks "Sign in with Twitter"
5. OAuth flow completes
6. User redirected to requested page

## Security

- All routes protected by middleware
- JWT session strategy with 30-day expiry
- Secure cookies in production (HTTPS)
- CSRF protection via NextAuth
- Twitter OAuth 2.0
