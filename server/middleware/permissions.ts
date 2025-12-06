import { Request, Response, NextFunction } from 'express';
import { sql } from '../db/index.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        id: string;
        email: string;
        role?: string;
      };
    }
  }
}

// Middleware to require admin role
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check user role
    const [user] = await sql`
      SELECT role FROM users WHERE id = ${userId}
    `;

    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Attach role to request
    if (req.user) {
      req.user.role = user.role;
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
}

// Middleware to require premium subscription
export async function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check subscription
    const [subscription] = await sql`
      SELECT plan, status FROM subscriptions 
      WHERE user_id = ${userId} AND status = 'active'
    `;

    if (!subscription || (subscription.plan !== 'premium' && subscription.plan !== 'pro')) {
      res.status(403).json({ 
        error: 'Premium subscription required',
        upgrade: true 
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Premium check error:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
}

