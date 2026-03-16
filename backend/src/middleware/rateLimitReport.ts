import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60;

const store = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

/** Rate-limit public report API: 60 req/min per IP. */
export function rateLimitReport(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  } else {
    entry.count++;
  }

  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests', retryAfter: 60 });
    return;
  }
  next();
}
