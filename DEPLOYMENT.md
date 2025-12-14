# Vercel Deployment Guide

## Build Configuration

The app is configured to use webpack for building:
- Dev: `npm run dev` (uses --webpack flag)
- Build: `npm run build` (uses --webpack flag)

## Environment Variables

You need to set these in your Vercel project settings:

1. **Twitter OAuth**
   - `TWITTER_CLIENT_ID` - Your Twitter OAuth 2.0 client ID
   - `TWITTER_CLIENT_SECRET` - Your Twitter OAuth 2.0 client secret

2. **NextAuth**
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your production URL (e.g., https://your-app.vercel.app)

3. **LLM API** (Optional)
   - `OPENROUTER_API_KEY` - OpenRouter API key for LLM features

## Twitter OAuth Setup

Update your Twitter Developer Portal with the production callback URL:
- Add to "OAuth 2.0 Redirect URIs": `https://your-app.vercel.app/api/auth/callback/twitter`

## Database

The database file (`podcasts.db`) is loaded from the `/public` folder at runtime.
Make sure it's committed to your repository or uploaded to Vercel.

## Build Command

Vercel will automatically use: `npm run build`

This uses webpack (not Turbopack) to properly handle the sql.js library.
