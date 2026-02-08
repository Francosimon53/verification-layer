import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-01-28.clover',
});

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      'Unlimited projects',
      'Basic compliance scanning',
      '163+ detection rules',
      'Community support',
      'Basic reports (JSON/MD)',
    ],
  },
  pro: {
    name: 'Pro',
    priceMonthly: 49,
    priceAnnual: 490,
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    annualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    trialDays: 14,
    features: [
      'Everything in Free',
      'Team dashboard',
      'Priority support',
      'Advanced analytics',
      'PDF audit reports',
      'GitHub integration',
      'Slack notifications',
      'Custom rules library',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: null,
    features: [
      'Everything in Pro',
      'Dedicated support',
      'Custom SSO/SAML',
      'SLA guarantee',
      'On-premise deployment',
      'Unlimited team members',
      'Custom training',
      'Compliance consulting',
    ],
  },
} as const;
