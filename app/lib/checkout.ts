// ============================================================================
// PAYMENT SEAM — this is the ONLY file you change when you pick a provider.
// ============================================================================
// Right now there is no payment provider, so checkout runs in "demo" mode:
// the order is created locally and treated as paid. The checkout page calls
// `processCheckout()` and never needs to know which provider you chose.
//
// NOTE: A real Hydrogen store would hand off to Shopify's hosted checkout via
// `cart.checkoutUrl`. This demo flow is a visual clone of the Next.js app.
import type {Order} from '~/stores/order';

export type PaymentMode = 'demo' | 'razorpay' | 'stripe-link' | 'cod';

// 👇 Change this one value when you're ready. Keep "demo" for now.
export const PAYMENT_MODE: PaymentMode = 'demo';

export type CheckoutResult =
  | {status: 'paid'}
  | {status: 'pending'} // e.g. Cash on Delivery / redirect away
  | {status: 'failed'; reason: string};

export async function processCheckout(order: Order): Promise<CheckoutResult> {
  switch (PAYMENT_MODE) {
    case 'demo':
      // No money moves. Pretend success so you can build/test the full flow.
      return {status: 'paid'};

    case 'cod':
      // Cash on Delivery: no online payment, just record the order.
      return {status: 'pending'};

    case 'razorpay':
      throw new Error('Razorpay not wired up yet — implement payWithRazorpay().');

    case 'stripe-link':
      throw new Error('Stripe Payment Link not configured yet.');

    default:
      return {status: 'failed', reason: 'Unknown payment mode'};
  }
}
