import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY not set. Stripe features will be disabled.');
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    })
  : null;

// Stripe configuration
export const STRIPE_CONFIG = {
  premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID || '',
  premiumProductId: process.env.STRIPE_PREMIUM_PRODUCT_ID || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};

// Helper to check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!stripe && !!STRIPE_CONFIG.premiumPriceId;
}

// Create or retrieve Stripe customer
export async function getOrCreateCustomer(userId: string, email: string, name?: string): Promise<string | null> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Check if customer already exists in database
  const { sql } = await import('../db/index.js');
  const [existing] = await sql`
    SELECT stripe_customer_id FROM subscriptions 
    WHERE user_id = ${userId} AND stripe_customer_id IS NOT NULL
    LIMIT 1
  `;

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || email,
    metadata: {
      userId,
    },
  });

  // Update database with customer ID
  await sql`
    INSERT INTO subscriptions (user_id, stripe_customer_id, plan, status)
    VALUES (${userId}, ${customer.id}, 'free', 'active')
    ON CONFLICT (user_id) 
    DO UPDATE SET stripe_customer_id = ${customer.id}
  `;

  return customer.id;
}

// Create checkout session
export async function createCheckoutSession(
  customerId: string,
  userId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session | null> {
  if (!stripe || !STRIPE_CONFIG.premiumPriceId) {
    throw new Error('Stripe is not configured');
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: STRIPE_CONFIG.premiumPriceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  });

  return session;
}

// Create portal session for managing subscription
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session | null> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription | null> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  } else {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

// Resume subscription
export async function resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

