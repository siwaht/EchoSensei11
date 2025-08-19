import Stripe from 'stripe';
import { Request, Response } from 'express';
import { db } from './db';
import { organizations, billingPackages, payments } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Stripe only if the secret key is available
let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-07-30.basil',
  });
}

export async function createPaymentIntent(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(400).json({ 
        error: 'Stripe is not configured. Please add your Stripe API keys.' 
      });
    }

    const { organizationId, packageId, amount } = req.body;

    if (!organizationId || !amount) {
      return res.status(400).json({ 
        error: 'Organization ID and amount are required' 
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        organizationId,
        packageId: packageId || '',
      },
    });

    // Record the payment attempt in the database
    await db.insert(payments).values({
      organizationId,
      packageId,
      amount,
      status: 'pending',
      paymentMethod: 'stripe',
      transactionId: paymentIntent.id,
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      message: error.message 
    });
  }
}

export async function confirmPayment(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(400).json({ 
        error: 'Stripe is not configured' 
      });
    }

    const { paymentIntentId } = req.body;

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Update payment status in database
      await db.update(payments)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(payments.transactionId, paymentIntentId));

      // Update organization billing status if needed
      const organizationId = paymentIntent.metadata.organizationId;
      if (organizationId) {
        await db.update(organizations)
          .set({ 
            billingStatus: 'active',
            lastPaymentDate: new Date()
          })
          .where(eq(organizations.id, organizationId));
      }

      res.json({ success: true, status: 'completed' });
    } else {
      res.json({ success: false, status: paymentIntent.status });
    }
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ 
      error: 'Failed to confirm payment',
      message: error.message 
    });
  }
}

export async function createSubscription(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(400).json({ 
        error: 'Stripe is not configured' 
      });
    }

    const { organizationId, priceId, email } = req.body;

    // Create or retrieve customer
    let customer;
    const [org] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (org?.stripeCustomerId) {
      customer = await stripe.customers.retrieve(org.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: { organizationId }
      });

      // Save customer ID to organization
      await db.update(organizations)
        .set({ stripeCustomerId: customer.id })
        .where(eq(organizations.id, organizationId));
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent;

    res.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ 
      error: 'Failed to create subscription',
      message: error.message 
    });
  }
}

export async function handleWebhook(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(400).json({ 
        error: 'Stripe is not configured' 
      });
    }

    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.log('Webhook secret not configured, skipping signature verification');
      // Process webhook without signature verification in development
      const event = req.body;
      await processWebhookEvent(event);
      return res.json({ received: true });
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    await processWebhookEvent(event);
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({ 
      error: 'Webhook error',
      message: error.message 
    });
  }
}

async function processWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Update payment record
      await db.update(payments)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(payments.transactionId, paymentIntent.id));
      
      // Update organization status
      if (paymentIntent.metadata.organizationId) {
        await db.update(organizations)
          .set({ 
            billingStatus: 'active',
            lastPaymentDate: new Date()
          })
          .where(eq(organizations.id, paymentIntent.metadata.organizationId));
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object as Stripe.PaymentIntent;
      
      await db.update(payments)
        .set({ 
          status: 'failed',
          failedAt: new Date()
        })
        .where(eq(payments.transactionId, failedPayment.id));
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      
      // Find organization by Stripe customer ID
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeCustomerId, subscription.customer as string));
      
      if (org) {
        await db.update(organizations)
          .set({ 
            billingStatus: subscription.status === 'active' ? 'active' : 'inactive',
            subscriptionId: subscription.status === 'active' ? subscription.id : null
          })
          .where(eq(organizations.id, org.id));
      }
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

export function isStripeConfigured(): boolean {
  return !!stripe;
}