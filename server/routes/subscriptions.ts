import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sql } from '../db/index.js';
import { getOrCreateCustomer, createCheckoutSession, createPortalSession, cancelSubscription, resumeSubscription, isStripeConfigured } from '../services/stripe.js';
import { getMonthlyUsage } from '../services/usageTracker.js';

export const subscriptionRoutes = express.Router();

// Get subscription status
subscriptionRoutes.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get subscription from database
    const [subscription] = await sql`
      SELECT 
        plan,
        status,
        stripe_customer_id,
        stripe_subscription_id,
        current_period_start,
        current_period_end,
        canceled_at
      FROM subscriptions
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    // Get usage stats
    const usage = await getMonthlyUsage(userId);

    // If no subscription record, create free tier
    if (!subscription) {
      await sql`
        INSERT INTO subscriptions (user_id, plan, status)
        VALUES (${userId}, 'free', 'active')
        ON CONFLICT (user_id) DO NOTHING
      `;

      return res.json({
        plan: 'free',
        status: 'active',
        usage,
        stripeConfigured: isStripeConfigured(),
      });
    }

    const isActive = subscription.status === 'active';
    const isPremium = subscription.plan === 'premium' || subscription.plan === 'pro';
    const willCancel = subscription.canceled_at && new Date(subscription.canceled_at) > new Date();

    res.json({
      plan: subscription.plan,
      status: subscription.status,
      isPremium,
      isActive,
      willCancel,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      canceledAt: subscription.canceled_at,
      usage,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (error: any) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Create checkout session for premium upgrade
subscriptionRoutes.post('/checkout', requireAuth, async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Payment processing is not available' });
    }

    const userId = req.user?.id;
    const email = req.user?.email;

    if (!userId || !email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(userId, email, req.user?.name);

    // Create checkout session
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const session = await createCheckoutSession(
      customerId,
      userId,
      `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      `${baseUrl}/subscription/cancel`
    );

    if (!session || !session.url) {
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Create portal session for managing subscription
subscriptionRoutes.post('/portal', requireAuth, async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Payment processing is not available' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get Stripe customer ID
    const [subscription] = await sql`
      SELECT stripe_customer_id FROM subscriptions
      WHERE user_id = ${userId} AND stripe_customer_id IS NOT NULL
      LIMIT 1
    `;

    if (!subscription?.stripe_customer_id) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const session = await createPortalSession(
      subscription.stripe_customer_id,
      `${baseUrl}/subscription`
    );

    if (!session || !session.url) {
      return res.status(500).json({ error: 'Failed to create portal session' });
    }

    res.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message || 'Failed to create portal session' });
  }
});

// Cancel subscription
subscriptionRoutes.post('/cancel', requireAuth, async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Payment processing is not available' });
    }

    const userId = req.user?.id;
    const { immediately = false } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get subscription
    const [subscription] = await sql`
      SELECT stripe_subscription_id FROM subscriptions
      WHERE user_id = ${userId} AND stripe_subscription_id IS NOT NULL
      LIMIT 1
    `;

    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel in Stripe
    await cancelSubscription(subscription.stripe_subscription_id, immediately);

    // Update database
    if (immediately) {
      await sql`
        UPDATE subscriptions
        SET status = 'canceled', canceled_at = NOW()
        WHERE user_id = ${userId}
      `;
    } else {
      await sql`
        UPDATE subscriptions
        SET canceled_at = (
          SELECT current_period_end FROM subscriptions WHERE user_id = ${userId}
        )
        WHERE user_id = ${userId}
      `;
    }

    res.json({
      message: immediately
        ? 'Subscription canceled immediately'
        : 'Subscription will cancel at the end of the billing period',
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

// Resume subscription
subscriptionRoutes.post('/resume', requireAuth, async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Payment processing is not available' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get subscription
    const [subscription] = await sql`
      SELECT stripe_subscription_id FROM subscriptions
      WHERE user_id = ${userId} AND stripe_subscription_id IS NOT NULL
      LIMIT 1
    `;

    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Resume in Stripe
    await resumeSubscription(subscription.stripe_subscription_id);

    // Update database
    await sql`
      UPDATE subscriptions
      SET canceled_at = NULL
      WHERE user_id = ${userId}
    `;

    res.json({
      message: 'Subscription resumed successfully',
    });
  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to resume subscription' });
  }
});

