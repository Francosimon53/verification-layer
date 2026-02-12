import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      'CLI scanner with 163+ detection rules',
      '5 HIPAA compliance categories',
      'JSON & Markdown reports',
      'Community support (GitHub)',
      'Open source',
    ],
  },
  pro: {
    name: 'Pro',
    priceMonthly: 49,
    priceAnnual: 470,
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    annualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    trialDays: 14,
    features: [
      'Everything in Free',
      'Team dashboard with scan history',
      'GitHub App with automatic PR comments',
      'Pre-commit hooks',
      'HIPAA document templates (IRP, BAA, NPP)',
      'PDF audit-ready reports',
      'Custom rules library',
      'Slack integration',
      'Email support (48h SLA)',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: null,
    features: [
      'Everything in Pro',
      'Custom SSO/SAML integration',
      'Self-hosted / on-premise deployment',
      'Dedicated compliance consultant',
      'SLA guarantee (4h response)',
      'Audit trail & compliance reports',
      'Custom training modules',
    ],
  },
} as const;
