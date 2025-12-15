import { NextAuthOptions } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'podcasts.db');

export const authOptions: NextAuthOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[SIGNIN DEBUG] Callback called with:', {
        user,
        account: account ? 'present' : 'missing',
        profile: profile ? JSON.stringify(profile) : 'missing',
      });

      if (!account || !profile) {
        console.error('[SIGNIN DEBUG] Missing account or profile');
        return false;
      }

      try {
        console.log('[SIGNIN DEBUG] Opening database at:', DB_PATH);

        // Twitter OAuth 2.0 uses 'id' instead of 'sub'
        const twitterId = (profile as any).data?.id || profile.sub || (profile as any).id;
        console.log('[SIGNIN DEBUG] Twitter ID:', twitterId);
        console.log('[SIGNIN DEBUG] Profile keys:', Object.keys(profile));

        if (!twitterId) {
          console.error('[SIGNIN DEBUG] No Twitter ID found in profile!');
          return false;
        }

        const db = new Database(DB_PATH);

        // Check if user exists
        console.log('[SIGNIN DEBUG] Checking for user with twitter_id:', twitterId);
        let dbUser = db.prepare('SELECT * FROM users WHERE twitter_id = ?').get(twitterId);

        if (dbUser) {
          console.log('[SIGNIN DEBUG] User exists, updating last login');
          // Update last login
          db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run((dbUser as any).id);
        } else {
          console.log('[SIGNIN DEBUG] Creating new user');
          const username = (profile as any).data?.username || (profile as any).username || user.name;
          console.log('[SIGNIN DEBUG] Username:', username);
          // Create new user
          db.prepare(`
            INSERT INTO users (twitter_id, username, display_name, profile_image_url)
            VALUES (?, ?, ?, ?)
          `).run(
            twitterId,
            username,
            user.name,
            user.image
          );
        }

        db.close();
        console.log('[SIGNIN DEBUG] Sign in successful');
        return true;
      } catch (error) {
        console.error('[SIGNIN DEBUG] Sign in error:', error);
        return false;
      }
    },
    async session({ session, token }) {
      console.log('[SESSION DEBUG] Token:', { sub: token.sub, email: token.email });
      if (token.sub && session.user) {
        try {
          const db = new Database(DB_PATH, { readonly: true });
          // Try to find user by twitter_id (token.sub should be the twitter ID after sign in)
          const user = db.prepare('SELECT * FROM users WHERE twitter_id = ?').get(token.sub);
          db.close();

          console.log('[SESSION DEBUG] User found:', user ? 'yes' : 'no');
          if (user) {
            (session.user as any).id = (user as any).id;
            (session.user as any).twitter_id = (user as any).twitter_id;
          }
        } catch (error) {
          console.error('[SESSION DEBUG] Session error:', error);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
