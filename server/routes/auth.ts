import express from 'express';
import { verifyStackAuth, optionalStackAuth } from '../middleware/stackAuth.js';
import { stackServerApp } from '../lib/stack.js';

export const authRoutes = express.Router();

// Get current user info
authRoutes.get('/me', verifyStackAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Sign out (client-side handles this, but we can provide an endpoint)
authRoutes.post('/signout', optionalStackAuth, async (req, res) => {
  try {
    // Stack Auth handles signout on the client side
    // This endpoint is mainly for logging or cleanup if needed
    res.json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Sign out error:', error);
    res.status(500).json({ error: 'Failed to sign out' });
  }
});

