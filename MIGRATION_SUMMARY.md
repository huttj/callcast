# Migration Summary: Express + React → Next.js

This document summarizes the migration of the podcast research tool from Express.js + React to Next.js with full authentication protection.

## What Was Migrated

### ✅ Authentication System
- **From**: Passport.js with Express sessions
- **To**: NextAuth v5 with Twitter OAuth 2.0
- **Changes**:
  - JWT-based sessions (more scalable for serverless)
  - Built-in CSRF protection
  - Automatic session management
  - Middleware-based route protection

### ✅ API Endpoints
All Express API routes have been migrated to Next.js API routes:

| Express Route | Next.js Route | Status |
|--------------|---------------|---------|
| `POST /api/embed` | `app/api/embed/route.ts` | ✅ Migrated |
| `POST /api/search-research` | `app/api/search-research/route.ts` | ✅ Migrated |
| `POST /api/research-chat` | `app/api/research-chat/route.ts` | ✅ Migrated |
| `GET /api/analytics/stats` | `app/api/analytics/stats/route.ts` | ✅ Migrated |
| `GET /api/utterances-2d` | `app/api/utterances-2d/route.ts` | ✅ Migrated |
| `POST /api/name-clusters` | `app/api/name-clusters/route.ts` | ✅ Migrated |
| `POST /api/clear-umap-cache` | `app/api/clear-umap-cache/route.ts` | ✅ Migrated |
| `GET /api/mind-maps` | `app/api/mind-maps/route.ts` | ✅ Migrated |
| `POST /api/mind-map-nodes` | `app/api/mind-map-nodes/route.ts` | ✅ Migrated |

### ✅ Authentication Middleware
- **Global protection**: `middleware.ts` protects ALL routes except `/login` and `/api/auth/*`
- **Automatic redirects**: Unauthenticated users are redirected to login with callback URL
- **No manual checks needed**: NextAuth handles session validation automatically

### ✅ Database Integration
- SQLite database (`podcasts.db`) remains unchanged
- Database path: `../podcasts.db` (relative to Next.js app)
- All database operations work the same way
- Analytics tracking preserved

### ✅ Machine Learning
- Embedding model (Xenova/transformers) migrated to shared utilities
- UMAP clustering migrated with file-based caching
- Cosine similarity and semantic search functions preserved
- LLM integration (OpenRouter) migrated to utility module

## New File Structure

```
nextjs-app/
├── app/
│   ├── api/                  # API routes (protected by auth)
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── embed/route.ts
│   │   ├── search-research/route.ts
│   │   ├── research-chat/route.ts
│   │   ├── analytics/stats/route.ts
│   │   ├── utterances-2d/route.ts
│   │   ├── name-clusters/route.ts
│   │   ├── clear-umap-cache/route.ts
│   │   ├── mind-maps/route.ts
│   │   └── mind-map-nodes/route.ts
│   ├── login/page.tsx        # Login page (Twitter OAuth)
│   ├── page.tsx              # Main app (protected)
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Tailwind styles
├── lib/
│   ├── auth.ts               # NextAuth config
│   ├── ml.ts                 # ML utilities
│   ├── analytics.ts          # Analytics tracking
│   └── llm.ts                # LLM API calls
├── middleware.ts             # Global auth middleware
├── vercel.json               # Vercel config
├── .env.example              # Environment template
├── DEPLOYMENT.md             # Deployment guide
└── README.md                 # Project docs
```

## Environment Variables

### Old (Express)
```env
TWITTER_CONSUMER_KEY=...
TWITTER_CONSUMER_SECRET=...
TWITTER_CALLBACK_URL=...
SESSION_SECRET=...
OPENROUTER_API_KEY=...
```

### New (Next.js)
```env
TWITTER_CLIENT_ID=...        # Same as TWITTER_CONSUMER_KEY
TWITTER_CLIENT_SECRET=...    # Same as TWITTER_CONSUMER_SECRET
AUTH_SECRET=...              # Replaces SESSION_SECRET
OPENROUTER_API_KEY=...       # Unchanged
NEXTAUTH_URL=...             # Production URL (for Vercel)
```

## Breaking Changes

### 1. Session Format
- **Old**: Express session with Passport user object
- **New**: JWT-based NextAuth session
- **Impact**: Frontend code that accesses `req.user` must be updated to use NextAuth's session format

### 2. Authentication Check
- **Old**: `req.isAuthenticated()` in Express
- **New**: `await auth()` from NextAuth
- **Impact**: All protected routes now use NextAuth's `auth()` helper

### 3. UMAP Cache
- **Old**: In-memory cache variable
- **New**: File-based cache (`.umap-cache.json`)
- **Impact**: Cache persists across server restarts locally, but not on Vercel (read-only filesystem)

### 4. Frontend
- **Old**: React SPA served separately
- **New**: Next.js server components with basic UI
- **Impact**: Full React frontend NOT yet migrated (see "What's Not Migrated" below)

## What's NOT Migrated (Yet)

### Frontend Components
The following React components from `frontend/src/components/` are NOT yet migrated:
- `SearchResults.jsx` - Search results display
- `ResearchResults.jsx` - Research topics display
- `ResearchChat.jsx` - Chat interface
- `VideoPlayer.jsx` - Video player with timestamp seeking
- `TranscriptView.jsx` - Transcript viewer
- `UtteranceMap.jsx` - 2D UMAP visualization
- `MindMap.jsx` - Mind map visualization
- `Filters.jsx` - Search filters
- `Statistics.jsx` - Analytics dashboard

### Current State
The main application page (`app/page.tsx`) is a placeholder with:
- User authentication display
- Sign out button
- Search input (non-functional)
- Message about future functionality

### To Complete Migration
To fully migrate the frontend:
1. Convert React components to Next.js client components
2. Update state management for Next.js
3. Integrate with new API routes
4. Add URL parameter handling for shareable links
5. Implement video player with timestamp navigation

## How to Test

### 1. Set Up Environment
```bash
cd nextjs-app
cp .env.example .env.local
# Edit .env.local with your credentials
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Test Authentication
1. Visit http://localhost:3000
2. Should redirect to `/login`
3. Click "Sign in with Twitter"
4. Authorize the app
5. Should redirect back to main page
6. Should see your Twitter username

### 4. Test API Routes
```bash
# Search research topics (requires auth)
curl -X POST http://localhost:3000/api/search-research \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=..." \
  -d '{"query": "documentation", "limit": 10}'

# Get analytics (requires auth)
curl -X GET http://localhost:3000/api/analytics/stats \
  -H "Cookie: authjs.session-token=..."
```

## Deployment to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

### Quick Steps
1. Set environment variables in Vercel dashboard
2. Update Twitter OAuth callback URLs
3. Deploy with `vercel` CLI or GitHub integration
4. Test authentication flow in production

### Important Notes
- Database must be uploaded as static file (read-only)
- For production, consider migrating to PostgreSQL
- UMAP cache won't persist on Vercel (read-only filesystem)
- Consider using Vercel KV for caching

## Benefits of Migration

### ✅ Vercel-Ready
- Serverless functions auto-scale
- Global CDN for static assets
- Built-in HTTPS and domain management
- Zero-config deployment

### ✅ Better Authentication
- Modern OAuth 2.0 flow (vs OAuth 1.0a)
- JWT sessions (more scalable)
- Built-in security features
- Easier to maintain

### ✅ TypeScript
- Type-safe API routes
- Better IDE support
- Catch errors at compile time
- Self-documenting code

### ✅ Simplified Architecture
- API and frontend in one repo
- Shared types between client and server
- Automatic code splitting
- Server-side rendering support

## Known Issues

### 1. Database on Vercel
- SQLite is read-only on Vercel
- User creation and analytics tracking will fail
- **Solution**: Migrate to PostgreSQL (Supabase, Neon)

### 2. UMAP Cache
- File-based cache doesn't work on Vercel
- Will recompute on every request
- **Solution**: Use Vercel KV or external Redis

### 3. Embedding Model
- Transformers.js may timeout in serverless functions
- Large model download on cold starts
- **Solution**: Pre-compute embeddings or use external API

## Next Steps

1. **Complete Frontend Migration** (Priority: High)
   - Migrate React components to Next.js
   - Implement search and chat UI
   - Add video player and transcript viewer

2. **Database Migration** (Priority: Medium)
   - Set up PostgreSQL on Supabase/Neon
   - Migrate schema and data
   - Update connection code

3. **Performance Optimization** (Priority: Medium)
   - Implement Redis caching (Vercel KV)
   - Pre-compute embeddings
   - Optimize UMAP computation

4. **Production Hardening** (Priority: Low)
   - Add error tracking (Sentry)
   - Set up monitoring (Vercel Analytics)
   - Implement rate limiting
   - Add comprehensive logging

## Questions?

- Check [README.md](./README.md) for setup instructions
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide
- Review [../AUTH_SETUP.md](../AUTH_SETUP.md) for database schema
