import express from 'express';
import { stripe, STRIPE_CONFIG } from '../services/stripe.js';
import { sql } from '../db/index.js';

export const webhookRoutes = express.Router();

// Stripe webhook endpoint
webhookRoutes.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig || !stripe || !STRIPE_CONFIG.webhookSecret) {
    console.error('Webhook signature or Stripe not configured');
    return res.status(400).send('Webhook error');
  }

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_CONFIG.webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Received webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;

        if (!userId) {
          console.error('No userId in checkout session metadata');
          break;
        }

        // Get subscription from Stripe
        const subscriptionId = session.subscription as string;
        if (!subscriptionId) {
          console.error('No subscription ID in checkout session');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Update database
        await sql`
          UPDATE subscriptions
          SET 
            plan = 'premium',
            status = 'active',
            stripe_subscription_id = ${subscriptionId},
            current_period_start = to_timestamp(${subscription.current_period_start}),
            current_period_end = to_timestamp(${subscription.current_period_end}),
            canceled_at = NULL,
            updated_at = NOW()
          WHERE user_id = ${userId}
          ON CONFLICT (user_id) DO UPDATE SET
            plan = 'premium',
            status = 'active',
            stripe_subscription_id = ${subscriptionId},
            current_period_start = to_timestamp(${subscription.current_period_start}),
            current_period_end = to_timestamp(${subscription.current_period_end}),
            canceled_at = NULL,
            updated_at = NOW()
        `;

        console.log(`Subscription activated for user ${userId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          // Try to find user by customer ID
          const [sub] = await sql`
            SELECT user_id FROM subscriptions
            WHERE stripe_customer_id = ${subscription.customer}
            LIMIT 1
          `;
          if (!sub) break;
          // Continue with found user_id
        }

        const status = subscription.status;
        const plan = subscription.items.data[0]?.price?.metadata?.plan || 'premium';

        await sql`
          UPDATE subscriptions
          SET
            status = ${status},
            plan = ${plan},
            current_period_start = to_timestamp(${subscription.current_period_start}),
            current_period_end = to_timestamp(${subscription.current_period_end}),
            canceled_at = ${subscription.cancel_at ? `to_timestamp(${subscription.cancel_at})` : null},
            updated_at = NOW()
          WHERE stripe_subscription_id = ${subscription.id}
        `;

        console.log(`Subscription updated: ${subscription.id}, status: ${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        await sql`
          UPDATE subscriptions
          SET
            status = 'canceled',
            canceled_at = NOW(),
            updated_at = NOW()
          WHERE stripe_subscription_id = ${subscription.id}
        `;

        console.log(`Subscription canceled: ${subscription.id}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          await sql`
            UPDATE subscriptions
            SET
              status = 'active',
              current_period_start = to_timestamp(${invoice.period_start}),
              current_period_end = to_timestamp(${invoice.period_end}),
              updated_at = NOW()
            WHERE stripe_subscription_id = ${subscriptionId}
          `;

          console.log(`Payment succeeded for subscription: ${subscriptionId}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          await sql`
            UPDATE subscriptions
            SET
              status = 'past_due',
              updated_at = NOW()
            WHERE stripe_subscription_id = ${subscriptionId}
          `;

          console.log(`Payment failed for subscription: ${subscriptionId}`);
          // TODO: Send email notification to user
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

