# Production Database Options for Vercel

Since better-sqlite3 uses native bindings and doesn't work on Vercel's serverless platform, you need a serverless-compatible database for production.

## Recommended: Vercel Postgres

1. **Install Vercel Postgres:**
   ```bash
   npm install @vercel/postgres
   ```

2. **Create database in Vercel dashboard:**
   - Go to your project → Storage → Create Database → Postgres

3. **Migrate schema:**
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     twitter_id VARCHAR(255) UNIQUE NOT NULL,
     username VARCHAR(255),
     display_name VARCHAR(255),
     profile_image_url TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. **Update lib/auth.ts:**
   ```typescript
   import { sql } from '@vercel/postgres';
   
   // In signIn callback:
   const result = await sql`
     INSERT INTO users (twitter_id, username, display_name, profile_image_url)
     VALUES (${twitterId}, ${username}, ${user.name}, ${user.image})
     ON CONFLICT (twitter_id) 
     DO UPDATE SET last_login_at = CURRENT_TIMESTAMP
     RETURNING *
   `;
   ```

## Alternative: Supabase

1. Create project at https://supabase.com
2. Use @supabase/supabase-js client
3. Free tier available

## Alternative: PlanetScale

1. Create database at https://planetscale.com
2. MySQL-compatible
3. Generous free tier

## Why SQLite Doesn't Work on Vercel

- Vercel runs on AWS Lambda (serverless)
- Each request runs in an isolated container
- File system is read-only (except /tmp)
- Native modules (C++ bindings) aren't supported
- better-sqlite3 requires native compilation

## Current Solution

The app currently works WITHOUT database user tracking on Vercel:
- Authentication works perfectly
- User data comes from Twitter OAuth
- No local user tracking (acceptable for MVP)
