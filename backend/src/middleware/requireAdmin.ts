import { Response } from 'express';
import { AuthRequest } from './auth';

/** Call after verifyToken + resolveCompany. Only admin can add staff. */
export function requireAdmin(req: AuthRequest, res: Response, next: () => void): void {
  if (req.role !== 'admin') {
    res.status(403).json({ error: 'Only company admin can add or manage staff' });
    return;
  }
  next();
}
