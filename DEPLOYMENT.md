# Vercel Deployment Guide

## Build Configuration

The app is configured to use webpack for building:
- Dev: `npm run dev` (uses --webpack flag)
- Build: `npm run build` (uses --webpack flag)

## Environment Variables

**IMPORTANT:** You need to set these in your Vercel project settings (Settings → Environment Variables):

1. **Twitter OAuth** (Required)
   - `TWITTER_CLIENT_ID` - Your Twitter OAuth 2.0 client ID
   - `TWITTER_CLIENT_SECRET` - Your Twitter OAuth 2.0 client secret

2. **NextAuth** (Required)
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your production URL (e.g., `https://callcast-one.vercel.app`)
     - **DO NOT include trailing slash**
     - Must match your domain exactly

3. **LLM API** (Optional)
   - `OPENROUTER_API_KEY` - OpenRouter API key for LLM features

## Twitter OAuth Setup

Update your Twitter Developer Portal with the production callback URL:

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Select your app
3. Go to "User authentication settings"
4. Under "OAuth 2.0 Redirect URIs", add:
   - `https://callcast-one.vercel.app/api/auth/callback/twitter`
   - (Replace with your actual Vercel domain)
5. Save the settings

## Database

The SQLite database is optional in production:
- In development: Uses `podcasts.db` from parent directory
- On Vercel: Database operations are skipped (authentication still works)
- The app will function without database for user tracking

If you need the full database functionality in production, consider:
- Vercel Postgres
- Supabase
- PlanetScale
- Other serverless database providers

## Build Command

Vercel will automatically use: `npm run build`

This uses webpack (not Turbopack) to properly handle the sql.js library.

## Troubleshooting

### "Access Denied" Error
- Check that all environment variables are set in Vercel
- Verify `NEXTAUTH_URL` matches your domain exactly (no trailing slash)
- Ensure Twitter callback URL is registered correctly

### Build Failures
- Check Vercel build logs for specific errors
- Ensure all dependencies are in `package.json`
- TypeScript errors will fail the build
