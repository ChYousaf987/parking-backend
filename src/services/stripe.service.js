import Stripe from 'stripe';

/** Stripe PKR minimum is ~100.00 — charge at least that so short stays still pay. */
export const STRIPE_MIN_PKR = 100;

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret || stripeSecret === 'sk_test_dummy') {
  console.warn(
    '[stripe] STRIPE_SECRET_KEY is missing or invalid. PaymentIntent creation will fail.'
  );
}

const stripe = new Stripe(stripeSecret || 'sk_test_dummy');

export const stripeService = {
  /** Bill amount raised to Stripe's minimum when needed. */
  resolveChargeAmount: amount => {
    const billAmount = Number(amount) || 0;
    return Math.max(billAmount, STRIPE_MIN_PKR);
  },

  // Create customer
  createCustomer: async (email, name, phone) => {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          source: 'parking-app',
        },
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  },

  // Create payment intent
  createPaymentIntent: async (customerId, amount, sessionId, description) => {
    try {
      if (!stripeSecret || stripeSecret === 'sk_test_dummy') {
        throw new Error(
          'Stripe is not configured on the server (missing STRIPE_SECRET_KEY)'
        );
      }

      const billAmount = Number(amount) || 0;
      const chargedAmount = stripeService.resolveChargeAmount(billAmount);
      const amountInSubunits = Math.round(chargedAmount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        customer: customerId,
        amount: amountInSubunits,
        currency: 'pkr',
        payment_method_types: ['card'],
        description,
        metadata: {
          sessionId: String(sessionId),
          billedAmount: String(billAmount),
          chargedAmount: String(chargedAmount),
        },
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },

  // Confirm payment (only when still open)
  confirmPayment: async (paymentIntentId, paymentMethodId) => {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
        }
      );
      return paymentIntent;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  },

  // Get payment status
  getPaymentStatus: async paymentIntentId => {
    try {
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw error;
    }
  },

  // Refund payment
  refundPayment: async (paymentIntentId, amount = null) => {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });
      return refund;
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw error;
    }
  },

  // List payment methods
  getPaymentMethods: async customerId => {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      return paymentMethods.data;
    } catch (error) {
      console.error('Error getting payment methods:', error);
      throw error;
    }
  },

  // Create subscription (for monthly parking)
  createSubscription: async (customerId, priceId) => {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
      });
      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  },
};
