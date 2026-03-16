import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './auth';

const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'customer-jwt-dev-secret-change-in-production';
const CUSTOMER_JWT_EXPIRY = process.env.CUSTOMER_JWT_EXPIRY || '7d';

export interface CustomerAuthRequest extends AuthRequest {
  customerId?: string | null;
  customerCompanyId?: string | null;
}

export function signCustomerToken(payload: { customerId: string; companyId: string }): string {
  return jwt.sign(
    { sub: payload.customerId, companyId: payload.companyId, type: 'customer' },
    CUSTOMER_JWT_SECRET,
    { expiresIn: CUSTOMER_JWT_EXPIRY }
  );
}

export function verifyCustomerToken(req: CustomerAuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Customer token required.' });
    return;
  }
  const token = authHeader.split(' ')[1];
  if (!token?.trim()) {
    res.status(401).json({ error: 'Unauthorized', message: 'Customer token required.' });
    return;
  }
  try {
    const decoded = jwt.verify(token, CUSTOMER_JWT_SECRET) as { sub: string; companyId: string; type?: string };
    if (decoded.type !== 'customer') {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    req.customerId = decoded.sub;
    req.customerCompanyId = decoded.companyId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', message: 'Please log in again.' });
  }
}
