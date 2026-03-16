import { Request, Response, NextFunction } from 'express';

type WindowConfig = {
  windowMs: number;
  max: number;
};

type Entry = {
  count: number;
  first: number;
};

const store = new Map<string, Entry>();

function cleanupExpired(windowMs: number) {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.first > windowMs) {
      store.delete(key);
    }
  }
}

export function rateLimitAuth(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || 'unknown';
    const path = req.path;
    const key = `${path}:${ip}`;

    cleanupExpired(windowMs);

    const now = Date.now();
    const entry = store.get(key);
    if (!entry) {
      store.set(key, { count: 1, first: now });
      next();
      return;
    }

    if (now - entry.first > windowMs) {
      store.set(key, { count: 1, first: now });
      next();
      return;
    }

    if (entry.count >= max) {
      res.status(429).json({ error: 'Too many requests, please try again later.' });
      return;
    }

    entry.count += 1;
    store.set(key, entry);
    next();
  };
}

