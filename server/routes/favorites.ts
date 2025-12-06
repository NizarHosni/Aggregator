import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sql } from '../db/index.js';

export const favoritesRoutes = express.Router();

// Get user's favorites
favoritesRoutes.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    const favorites = await sql`
      SELECT 
        id,
        npi,
        name,
        specialty,
        location,
        phone,
        rating,
        years_experience,
        google_place_id,
        healthgrades_id,
        website,
        created_at
      FROM favorite_doctors
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    res.json({ favorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Add doctor to favorites
favoritesRoutes.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const {
      npi,
      name,
      specialty,
      location,
      phone,
      rating = 0,
      years_experience = 0,
      googlePlaceId,
      healthgradesId,
      website,
    } = req.body;

    if (!npi || !name || !specialty || !location || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use INSERT ... ON CONFLICT to handle duplicates
    const result = await sql`
      INSERT INTO favorite_doctors (
        user_id, npi, name, specialty, location, phone,
        rating, years_experience, google_place_id, healthgrades_id, website, photo_url
      )
      VALUES (
        ${userId}, ${npi}, ${name}, ${specialty}, ${location}, ${phone},
        ${rating}, ${years_experience}, ${googlePlaceId || null}, ${healthgradesId || null}, ${website || null}, ${req.body.photoUrl || null}
      )
      ON CONFLICT (user_id, npi) DO UPDATE
      SET 
        name = EXCLUDED.name,
        specialty = EXCLUDED.specialty,
        location = EXCLUDED.location,
        phone = EXCLUDED.phone,
        rating = EXCLUDED.rating,
        years_experience = EXCLUDED.years_experience,
        google_place_id = COALESCE(EXCLUDED.google_place_id, favorite_doctors.google_place_id),
        healthgrades_id = COALESCE(EXCLUDED.healthgrades_id, favorite_doctors.healthgrades_id),
        website = COALESCE(EXCLUDED.website, favorite_doctors.website),
        photo_url = COALESCE(EXCLUDED.photo_url, favorite_doctors.photo_url)
      RETURNING *
    `;

    res.json({ favorite: result[0] });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove doctor from favorites
favoritesRoutes.delete('/:npi', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { npi } = req.params;

    const result = await sql`
      DELETE FROM favorite_doctors
      WHERE user_id = ${userId} AND npi = ${npi}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ message: 'Favorite removed successfully' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

