import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { sql } from '../db/index.js';

export const historyRoutes = express.Router();

// Get search history
historyRoutes.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const history = await sql`
      SELECT id, query, specialty, location, results_count, created_at
      FROM search_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch search history' });
  }
});

// Delete a search history item
historyRoutes.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const result = await sql`
      DELETE FROM search_history
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Search history item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting history item:', error);
    res.status(500).json({ error: 'Failed to delete search history item' });
  }
});

// Clear all search history
historyRoutes.delete('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    await sql`
      DELETE FROM search_history
      WHERE user_id = ${userId}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing history:', error);
    res.status(500).json({ error: 'Failed to clear search history' });
  }
});

