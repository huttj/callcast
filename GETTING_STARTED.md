# Getting Started with the Next.js Migration

This is a quick-start guide to get the migrated Next.js app running.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Twitter Developer account with OAuth 2.0 app created
- [ ] Twitter app callback URL configured
- [ ] OpenRouter API key obtained
- [ ] Database file (`podcasts.db`) available

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd nextjs-app
npm install
```

This installs:
- Next.js 16
- NextAuth v5
- TypeScript
- Tailwind CSS
- Transformers.js (for embeddings)
- Better-SQLite3
- ML libraries (UMAP, K-means)

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Edit with your credentials
nano .env.local  # or use your preferred editor
```

Required variables:
```env
TWITTER_CLIENT_ID=your_twitter_client_id_here
TWITTER_CLIENT_SECRET=your_twitter_client_secret_here
AUTH_SECRET=your_nextauth_secret_here
OPENROUTER_API_KEY=your_openrouter_key_here
```

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Configure Twitter OAuth

In your Twitter Developer Portal (https://developer.twitter.com/en/portal/dashboard):

1. Go to your app settings
2. Set **App permissions** to "Read"
3. Add **Callback URLs**:
   - Development: `http://localhost:3000/api/auth/callback/twitter`
   - Production: `https://your-domain.vercel.app/api/auth/callback/twitter`
4. Set **Website URL** to `http://localhost:3000`

### 4. Verify Database Location

Make sure `podcasts.db` is in the parent directory:

```bash
# From nextjs-app directory
ls ../podcasts.db
```

Should show: `../podcasts.db`

If not, copy it:
```bash
cp /path/to/your/podcasts.db ../podcasts.db
```

### 5. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## What Should Happen

1. **First Visit**
   - Browser opens to http://localhost:3000
   - Middleware detects no session
   - Redirects to `/login`

2. **Login Page**
   - Shows "Podcast Index" header
   - "Sign in to access the research tool" message
   - Blue "Sign in with Twitter" button

3. **Twitter OAuth**
   - Click button → redirects to Twitter
   - Authorize the app
   - Redirects back to your app

4. **Main Page**
   - Shows "Podcast Research Tool" header
   - Displays your Twitter username
   - Shows "Sign Out" button
   - Search interface (currently a placeholder)

## Troubleshooting

### "Authentication required" on API routes

**Problem**: API calls return 401 Unauthorized

**Solutions**:
- Make sure you're logged in (check for session)
- Clear cookies and log in again
- Check that `AUTH_SECRET` is set correctly

### "Module not found" errors

**Problem**: Import errors when starting dev server

**Solutions**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Twitter OAuth fails

**Problem**: OAuth flow errors or redirects fail

**Solutions**:
- Verify callback URL in Twitter Portal matches exactly: `http://localhost:3000/api/auth/callback/twitter`
- Check `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are correct
- Make sure your Twitter app uses OAuth 2.0 (not 1.0a)
- Check Twitter app permissions are set to "Read"

### Database not found

**Problem**: API routes fail with "no such table" or "database not found"

**Solutions**:
```bash
# Verify database exists
ls -la ../podcasts.db

# Check tables exist
sqlite3 ../podcasts.db ".tables"

# Should show: users, analytics_events, research_topics, etc.
```

### Embedding model fails to load

**Problem**: API calls timeout or fail with model errors

**Solutions**:
- First request takes time (downloading model)
- Wait 30-60 seconds for model to download
- Check internet connection (model downloads from Hugging Face)
- Look for "Model loaded successfully!" in console

## Testing the API

Once logged in, you can test API endpoints:

### Search Research Topics

```bash
# Get session token from browser cookies
# Then make request:
curl -X POST http://localhost:3000/api/search-research \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=YOUR_TOKEN" \
  -d '{"query": "documentation", "limit": 10}'
```

### Chat with RAG

```bash
curl -X POST http://localhost:3000/api/research-chat \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=YOUR_TOKEN" \
  -d '{
    "query": "What do they say about documentation?",
    "conversationHistory": []
  }'
```

### Get Analytics

```bash
curl -X GET http://localhost:3000/api/analytics/stats \
  -H "Cookie: authjs.session-token=YOUR_TOKEN"
```

## Next Steps

### Option 1: Deploy to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

Quick deploy:
```bash
npm i -g vercel
vercel
```

### Option 2: Complete Frontend Migration

The current frontend is a placeholder. To get the full UI:

1. Migrate React components from `../frontend/src/components/`
2. Create Next.js client components
3. Integrate with new API routes
4. Add state management
5. Implement video player and chat interface

See [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md) for details.

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
sqlite3 ../podcasts.db ".schema users"        # View users table
sqlite3 ../podcasts.db "SELECT COUNT(*) FROM research_topics"  # Count topics

# Environment
openssl rand -base64 32  # Generate AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # Alternative

# Logs
tail -f .next/trace      # View Next.js logs
```

## File Locations

- **Environment**: `.env.local` (not committed to git)
- **Database**: `../podcasts.db` (one level up)
- **UMAP Cache**: `.umap-cache.json` (auto-generated)
- **Session Secret**: In `.env.local` as `AUTH_SECRET`
- **Logs**: `.next/trace` and console output

## Getting Help

1. Check [README.md](./README.md) for project overview
2. See [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md) for what changed
3. Review [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel deployment
4. Look at [../AUTH_SETUP.md](../AUTH_SETUP.md) for database schema

## Success Criteria

You'll know everything is working when:

✅ You can visit http://localhost:3000
✅ Login page appears automatically
✅ Twitter OAuth flow completes successfully
✅ Main page shows your Twitter username
✅ API routes return data (not 401 errors)
✅ No console errors about missing modules
✅ Database queries work correctly

If all these are true, you're ready to either deploy or continue frontend development!
