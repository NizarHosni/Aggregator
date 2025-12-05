import express from 'express';
import { verifyStackAuth } from '../middleware/stackAuth.js';
import { sql } from '../db/index.js';

export const historyRoutes = express.Router();

// Get user's search history
historyRoutes.get('/', verifyStackAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await sql`
      SELECT 
        id,
        query,
        specialty,
        location,
        results_count,
        created_at
      FROM search_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get search history' });
  }
});

// Add search to history
historyRoutes.post('/', verifyStackAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { query, specialty, location, results_count = 0 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await sql`
      INSERT INTO search_history (user_id, query, specialty, location, results_count)
      VALUES (${userId}, ${query}, ${specialty || null}, ${location || null}, ${results_count})
      RETURNING *
    `;

    res.json({ historyItem: result[0] });
  } catch (error) {
    console.error('Add history error:', error);
    res.status(500).json({ error: 'Failed to add search history' });
  }
});

// Delete a history item
historyRoutes.delete('/:id', verifyStackAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const result = await sql`
      DELETE FROM search_history
      WHERE id = ${id}::uuid AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'History item not found' });
    }

    res.json({ message: 'History item deleted successfully' });
  } catch (error) {
    console.error('Delete history error:', error);
    res.status(500).json({ error: 'Failed to delete history item' });
  }
});

// Clear all history
historyRoutes.delete('/', verifyStackAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    await sql`
      DELETE FROM search_history
      WHERE user_id = ${userId}
    `;

    res.json({ message: 'History cleared successfully' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

