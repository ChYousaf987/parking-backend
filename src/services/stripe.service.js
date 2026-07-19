import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');

export const stripeService = {
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
      const paymentIntent = await stripe.paymentIntents.create({
        customer: customerId,
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'pkr',
        description,
        metadata: {
          sessionId,
        },
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },

  // Confirm payment
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
