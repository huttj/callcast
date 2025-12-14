# Deployment Guide for Vercel

This guide covers deploying the Next.js podcast research app to Vercel with Twitter authentication.

## Prerequisites

1. **Twitter Developer Account** with OAuth 2.0 app configured
2. **Vercel Account** (free tier works)
3. **OpenRouter API Key** for LLM calls
4. **Database File** (`podcasts.db`) ready to upload

## Step 1: Prepare Environment Variables

Create a `.env.local` file with these variables:

```bash
# Twitter OAuth
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# NextAuth Secret (generate with: openssl rand -base64 32)
AUTH_SECRET=your_generated_secret

# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_key

# Production URL (will be updated after first deploy)
NEXTAUTH_URL=https://your-app.vercel.app
```

## Step 2: Configure Twitter OAuth Callback URLs

In your Twitter Developer Portal, add these callback URLs:

- Development: `http://localhost:3000/api/auth/callback/twitter`
- Production: `https://your-app.vercel.app/api/auth/callback/twitter`

## Step 3: Database Handling

The SQLite database needs special handling on Vercel since Vercel is read-only:

### Option A: Read-Only Database (Recommended for MVP)

1. Place `podcasts.db` in the project root (parent of nextjs-app)
2. Add to `vercel.json`:

```json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "includeFiles": ["../podcasts.db"]
}
```

**Note**: Analytics and new user creation will fail. This works for read-only access.

### Option B: External Database (Recommended for Production)

Use a hosted PostgreSQL database:

1. Sign up for [Supabase](https://supabase.com) or [Neon](https://neon.tech)
2. Migrate SQLite schema to PostgreSQL
3. Update database connection code
4. Add `DATABASE_URL` to environment variables

## Step 4: Deploy to Vercel

### Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to nextjs-app directory
cd nextjs-app

# Deploy
vercel

# Follow prompts to link project
```

### Via GitHub Integration

1. Push code to GitHub repository
2. Connect repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

## Step 5: Configure Environment Variables in Vercel

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all variables from `.env.local`
3. Set `NEXTAUTH_URL` to your production URL (e.g., `https://your-app.vercel.app`)
4. Redeploy if variables were added after initial deployment

## Step 6: Update Twitter OAuth Callback

After deployment:

1. Note your Vercel production URL
2. Add callback URL in Twitter Developer Portal:
   - `https://your-app.vercel.app/api/auth/callback/twitter`
3. Update `NEXTAUTH_URL` in Vercel environment variables

## Step 7: Test Authentication

1. Visit your production URL
2. You should be redirected to `/login`
3. Click "Sign in with Twitter"
4. Authorize the app
5. You should be redirected back and logged in

## Performance Optimization

### Edge Functions

For better global performance, consider using Edge Runtime for API routes:

```typescript
// Add to API routes
export const runtime = 'edge';
```

**Note**: Edge runtime doesn't support all Node.js APIs. The embedding model may need adjustments.

### Caching

UMAP computations are expensive. The app uses file-based caching:

- Cache is stored in `.umap-cache.json`
- Vercel's read-only filesystem means cache won't persist between deployments
- Consider using Redis (Vercel KV) for persistent caching

## Troubleshooting

### "Authentication required" errors

- Check that `AUTH_SECRET` is set correctly
- Verify `NEXTAUTH_URL` matches your production URL
- Clear cookies and try again

### Twitter OAuth fails

- Verify callback URL in Twitter Developer Portal is exact
- Check that `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are correct
- Ensure Twitter app permissions are set to "Read"

### Database not found

- Check that `podcasts.db` is included in deployment
- Verify file path in `lib/auth.ts`, `lib/analytics.ts`, etc.
- Consider using absolute paths or environment variables

### Embedding model fails to load

- Transformers.js may have issues in serverless environment
- Consider pre-computing embeddings and storing in database
- Or use external embedding API (OpenAI, Cohere)

## Monitoring

- Enable Vercel Analytics for performance monitoring
- Set up error tracking (Sentry, LogRocket)
- Monitor API route logs in Vercel dashboard

## Cost Considerations

- **Vercel**: Free tier has limits on function execution time and bandwidth
- **OpenRouter**: Pay-per-token for LLM calls
- **Database**: Free tier for Supabase/Neon with limits

## Security Checklist

- [ ] `AUTH_SECRET` is cryptographically random
- [ ] Twitter API keys are kept secret
- [ ] Environment variables are set in Vercel, not committed to git
- [ ] OAuth callback URLs are limited to your domain
- [ ] Database credentials (if using external DB) are secure
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented (if needed)

## Next Steps

After successful deployment:

1. Monitor error logs for issues
2. Set up custom domain (optional)
3. Enable Vercel Analytics
4. Consider migrating to external database for full functionality
5. Implement caching strategy for better performance
