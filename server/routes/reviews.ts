import express from 'express';
import { sql } from '../db/index.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { uploadReviewPhotos } from '../utils/fileUpload.js';
import { processImages } from '../utils/imageProcessor.js';

export const reviewsRoutes = express.Router();

// Get all reviews for a doctor (public)
reviewsRoutes.get('/:doctorNpi', async (req, res) => {
  try {
    const { doctorNpi } = req.params;

    const reviews = await sql`
      SELECT 
        r.id,
        r.doctor_npi,
        r.rating,
        r.wait_time,
        r.bedside_manner,
        r.staff_friendliness,
        r.comment,
        r.photos,
        r.verified_patient,
        r.helpful_count,
        r.created_at,
        u.name as reviewer_name,
        u.email as reviewer_email
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.doctor_npi = ${doctorNpi}
      ORDER BY r.created_at DESC
    `;

    // Calculate summary statistics
    if (reviews.length === 0) {
      return res.json({
        doctorNpi,
        summary: {
          averageRating: 0,
          waitTime: 0,
          bedsideManner: 0,
          staffFriendliness: 0,
          totalReviews: 0,
        },
        reviews: [],
      });
    }

    const summary = reviews.reduce(
      (acc, review) => {
        acc.rating += review.rating || 0;
        acc.waitTime += review.wait_time || 0;
        acc.bedsideManner += review.bedside_manner || 0;
        acc.staffFriendliness += review.staff_friendliness || 0;
        return acc;
      },
      { rating: 0, waitTime: 0, bedsideManner: 0, staffFriendliness: 0 }
    );

    const count = reviews.length;

    res.json({
      doctorNpi,
      summary: {
        averageRating: Number((summary.rating / count).toFixed(1)),
        waitTime: Number((summary.waitTime / count).toFixed(1)),
        bedsideManner: Number((summary.bedsideManner / count).toFixed(1)),
        staffFriendliness: Number((summary.staffFriendliness / count).toFixed(1)),
        totalReviews: count,
      },
      reviews: reviews.map(r => ({
        id: r.id,
        doctorNpi: r.doctor_npi,
        rating: r.rating,
        waitTime: r.wait_time,
        bedsideManner: r.bedside_manner,
        staffFriendliness: r.staff_friendliness,
        comments: r.comment,
        photos: r.photos || [],
        verifiedPatient: r.verified_patient,
        helpfulCount: r.helpful_count,
        reviewerName: r.reviewer_name || 'Anonymous',
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// Create a review (requireAuth, with photo upload)
reviewsRoutes.post('/', requireAuth, uploadReviewPhotos, async (req, res) => {
  try {
    const userId = req.userId!;
    const {
      doctorNpi,
      rating,
      waitTime,
      bedsideManner,
      staffFriendliness,
      comment,
    } = req.body;

    // Validate required fields
    if (!doctorNpi || !rating || !comment) {
      return res.status(400).json({ error: 'Doctor NPI, rating, and comment are required' });
    }

    // Validate ratings
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Process uploaded photos
    let photoUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        photoUrls = await processImages(req.files);
      } catch (error) {
        console.error('Error processing review photos:', error);
        return res.status(500).json({ error: 'Failed to process uploaded photos' });
      }
    }

    // Check if user already reviewed this doctor
    const existing = await sql`
      SELECT id FROM reviews WHERE user_id = ${userId} AND doctor_npi = ${doctorNpi}
    `;

    if (existing.length > 0) {
      return res.status(409).json({ error: 'You have already reviewed this doctor. Use PUT to update your review.' });
    }

    // Insert review
    const [newReview] = await sql`
      INSERT INTO reviews (
        doctor_npi,
        user_id,
        rating,
        wait_time,
        bedside_manner,
        staff_friendliness,
        comment,
        photos,
        verified_patient
      )
      VALUES (
        ${doctorNpi},
        ${userId},
        ${rating},
        ${waitTime || rating},
        ${bedsideManner || rating},
        ${staffFriendliness || rating},
        ${comment},
        ${photoUrls},
        ${true}
      )
      RETURNING id, doctor_npi, rating, wait_time, bedside_manner, staff_friendliness, comment, photos, verified_patient, helpful_count, created_at
    `;

    res.status(201).json({
      message: 'Review created successfully',
      review: {
        id: newReview.id,
        doctorNpi: newReview.doctor_npi,
        rating: newReview.rating,
        waitTime: newReview.wait_time,
        bedsideManner: newReview.bedside_manner,
        staffFriendliness: newReview.staff_friendliness,
        comments: newReview.comment,
        photos: newReview.photos,
        verifiedPatient: newReview.verified_patient,
        helpfulCount: newReview.helpful_count,
        createdAt: newReview.created_at,
      },
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Update own review (requireAuth)
reviewsRoutes.put('/:id', requireAuth, uploadReviewPhotos, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const {
      rating,
      waitTime,
      bedsideManner,
      staffFriendliness,
      comment,
    } = req.body;

    // Check if review exists and belongs to user
    const [existing] = await sql`
      SELECT id, photos FROM reviews WHERE id = ${id} AND user_id = ${userId}
    `;

    if (!existing) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to edit it' });
    }

    // Process new photos if uploaded
    let photoUrls = existing.photos || [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        const newPhotos = await processImages(req.files);
        photoUrls = [...photoUrls, ...newPhotos].slice(0, 3); // Max 3 photos
      } catch (error) {
        console.error('Error processing review photos:', error);
      }
    }

    // Update review
    const [updatedReview] = await sql`
      UPDATE reviews
      SET
        rating = ${rating || existing.rating},
        wait_time = ${waitTime},
        bedside_manner = ${bedsideManner},
        staff_friendliness = ${staffFriendliness},
        comment = ${comment},
        photos = ${photoUrls},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, doctor_npi, rating, wait_time, bedside_manner, staff_friendliness, comment, photos, verified_patient, helpful_count, created_at, updated_at
    `;

    res.json({
      message: 'Review updated successfully',
      review: {
        id: updatedReview.id,
        doctorNpi: updatedReview.doctor_npi,
        rating: updatedReview.rating,
        waitTime: updatedReview.wait_time,
        bedsideManner: updatedReview.bedside_manner,
        staffFriendliness: updatedReview.staff_friendliness,
        comments: updatedReview.comment,
        photos: updatedReview.photos,
        verifiedPatient: updatedReview.verified_patient,
        helpfulCount: updatedReview.helpful_count,
        createdAt: updatedReview.created_at,
        updatedAt: updatedReview.updated_at,
      },
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete own review (requireAuth)
reviewsRoutes.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const result = await sql`
      DELETE FROM reviews
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to delete it' });
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Mark review as helpful (requireAuth)
reviewsRoutes.post('/:id/helpful', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [updated] = await sql`
      UPDATE reviews
      SET helpful_count = helpful_count + 1
      WHERE id = ${id}
      RETURNING helpful_count
    `;

    if (!updated) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({
      message: 'Thank you for your feedback',
      helpfulCount: updated.helpful_count,
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ error: 'Failed to mark review as helpful' });
  }
});

// Get current user's reviews (requireAuth)
reviewsRoutes.get('/my-reviews', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    const reviews = await sql`
      SELECT 
        id,
        doctor_npi,
        rating,
        wait_time,
        bedside_manner,
        staff_friendliness,
        comment,
        photos,
        verified_patient,
        helpful_count,
        created_at,
        updated_at
      FROM reviews
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        doctorNpi: r.doctor_npi,
        rating: r.rating,
        waitTime: r.wait_time,
        bedsideManner: r.bedside_manner,
        staffFriendliness: r.staff_friendliness,
        comments: r.comment,
        photos: r.photos || [],
        verifiedPatient: r.verified_patient,
        helpfulCount: r.helpful_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ error: 'Failed to get your reviews' });
  }
});
