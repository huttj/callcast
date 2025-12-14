/**
 * Analytics tracking utilities
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'podcasts.db');

export type EventType = 'research_search' | 'research_chat';

export interface EventData {
  query?: string;
  limit?: number;
  historyLength?: number;
  [key: string]: any;
}

/**
 * Track an analytics event
 */
export function trackEvent(
  userId: number | null,
  eventType: EventType,
  eventData: EventData
): void {
  try {
    const db = new Database(DB_PATH);
    db.prepare(`
      INSERT INTO analytics_events (user_id, event_type, event_data)
      VALUES (?, ?, ?)
    `).run(userId || null, eventType, JSON.stringify(eventData));
    db.close();
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

/**
 * Get analytics statistics
 */
export function getAnalyticsStats() {
  const db = new Database(DB_PATH, { readonly: true });

  const stats = {
    totalEvents: db.prepare('SELECT COUNT(*) as count FROM analytics_events').get() as { count: number },
    totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
    eventsByType: db.prepare(`
      SELECT event_type, COUNT(*) as count
      FROM analytics_events
      GROUP BY event_type
      ORDER BY count DESC
    `).all() as Array<{ event_type: string; count: number }>,
    recentEvents: db.prepare(`
      SELECT e.*, u.username
      FROM analytics_events e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC
      LIMIT 100
    `).all()
  };

  db.close();
  return stats;
}
