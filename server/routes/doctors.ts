import express from 'express';
import { sql } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { uploadBlogImage } from '../utils/fileUpload.js';
import { processImage } from '../utils/imageProcessor.js';

export const doctorsRoutes = express.Router();

// Admin only - update doctor photo (verified upload)
doctorsRoutes.put('/:npi/photo', requireAuth, requireAdmin, uploadBlogImage, async (req, res) => {
  try {
    const { npi } = req.params;
    const userId = req.userId!;

    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }

    // Process and compress the image
    let photoUrl: string;
    try {
      const processedPath = await processImage(req.file.path, {
        width: 400,
        height: 400,
        quality: 85,
      });
      // Convert to relative URL path
      photoUrl = processedPath.replace(/.*uploads/, '/uploads');
    } catch (error) {
      console.error('Error processing doctor photo:', error);
      return res.status(500).json({ error: 'Failed to process photo' });
    }

    // Store in doctors_photos table (centralized storage)
    await sql`
      INSERT INTO doctors_photos (npi, photo_url, verified, uploaded_by)
      VALUES (${npi}, ${photoUrl}, TRUE, ${userId})
      ON CONFLICT (npi) DO UPDATE
      SET 
        photo_url = EXCLUDED.photo_url,
        verified = TRUE,
        uploaded_by = EXCLUDED.uploaded_by,
        updated_at = NOW()
    `;

    // Also update favorite_doctors if this doctor is favorited
    await sql`
      UPDATE favorite_doctors
      SET 
        photo_url = ${photoUrl},
        photo_verified = TRUE
      WHERE npi = ${npi}
    `;

    res.json({
      message: 'Doctor photo uploaded and verified successfully',
      photoUrl,
      verified: true,
    });
  } catch (error) {
    console.error('Upload doctor photo error:', error);
    res.status(500).json({ error: 'Failed to upload doctor photo' });
  }
});

// Get doctor photo (public)
doctorsRoutes.get('/:npi/photo', async (req, res) => {
  try {
    const { npi } = req.params;

    const [photo] = await sql`
      SELECT photo_url, verified FROM doctors_photos WHERE npi = ${npi}
    `;

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json({
      photoUrl: photo.photo_url,
      verified: photo.verified,
    });
  } catch (error) {
    console.error('Get doctor photo error:', error);
    res.status(500).json({ error: 'Failed to get doctor photo' });
  }
});

