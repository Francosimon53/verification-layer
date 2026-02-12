'use client';

import { useState, useEffect } from 'react';
import { fetchSubscription, isPro, type UserSubscription } from '@/lib/plans';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [sub, setSub] = useState<UserSubscription | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription().then(setSub);

    // Check for cancelled checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'cancelled' || params.get('checkout') === 'cancelled') {
      setToast('Checkout cancelled. You can upgrade anytime.');
      window.history.replaceState({}, '', '/pricing');
    }
  }, []);

  const userIsPro = isPro(sub);

  const handleProUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingPeriod }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Error creating checkout session.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error starting checkout. Please try again.');
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Error opening billing portal.');
        setLoading(false);
      }
    } catch {
      alert('Error opening billing portal.');
      setLoading(false);
    }
  };

  const plans = [
    {
      name: 'Free',
      subtitle: 'Open Source',
      price: '$0',
      period: 'forever',
      description: 'For individual developers and open source projects',
      features: [
        'CLI scanner with 163+ detection rules',
        '5 HIPAA compliance categories',
        'JSON & Markdown reports',
        'Community support (GitHub)',
        'Open source',
      ],
      cta: userIsPro ? 'Free Plan' : 'Current Plan',
      disabled: true,
      onClick: undefined as (() => void) | undefined,
    },
    {
      name: 'Pro',
      price: billingPeriod === 'monthly' ? '$49' : '$470',
      period: billingPeriod === 'monthly' ? '/month' : '/year',
      description: 'For teams building healthcare applications',
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
      cta: userIsPro
        ? 'Manage Subscription'
        : loading
        ? 'Loading...'
        : 'Start 14-Day Free Trial',
      highlighted: true,
      disabled: loading,
      onClick: userIsPro ? handleManageSubscription : handleProUpgrade,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For organizations with advanced security needs',
      features: [
        'Everything in Pro',
        'Custom SSO/SAML integration',
        'Self-hosted / on-premise deployment',
        'Dedicated compliance consultant',
        'SLA guarantee (4h response)',
        'Audit trail & compliance reports',
        'Custom training modules',
      ],
      cta: 'Contact Sales',
      disabled: false,
      onClick: () => { window.location.href = 'mailto:sales@vlayer.app'; },
    },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl flex items-center gap-3">
          <span className="text-sm text-slate-300">{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-500 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">Choose Your Plan</h1>
            <p className="text-slate-400 mt-2">Scale your HIPAA compliance as you grow</p>
          </div>
        </div>
      </header>

      <div className="px-8 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-white' : 'text-slate-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
              className="relative w-14 h-7 bg-slate-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-emerald-500 rounded-full transition-transform ${billingPeriod === 'annual' ? 'translate-x-7' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm font-medium ${billingPeriod === 'annual' ? 'text-white' : 'text-slate-400'}`}>
              Annual
            </span>
            {billingPeriod === 'annual' && (
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
                Save 20%
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border shadow-xl flex flex-col ${
                  plan.highlighted
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 scale-105'
                    : 'border-slate-700'
                }`}
              >
                {plan.highlighted && (
                  <div className="text-center mb-4">
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-1">{plan.name}</h3>
                  {'subtitle' in plan && plan.subtitle && (
                    <p className="text-xs text-slate-500 mb-1">{plan.subtitle}</p>
                  )}
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-slate-400">{plan.period}</span>}
                  </div>
                  <p className="text-slate-400 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300">
                      <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={plan.disabled}
                  onClick={plan.onClick}
                  className={`w-full px-6 py-3 font-medium rounded-lg transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20'
                      : plan.disabled
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {plan.cta}
                </button>

                {plan.highlighted && billingPeriod === 'monthly' && (
                  <p className="text-xs text-slate-500 text-center mt-3">
                    Save 20% with annual billing — $470/year
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="mt-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-slate-700 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 text-center">Frequently Asked Questions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-2">Can I change plans later?</h4>
                <p className="text-slate-400 text-sm">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">What payment methods do you accept?</h4>
                <p className="text-slate-400 text-sm">
                  We accept all major credit cards and can provide invoicing for annual plans.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Is there a free trial?</h4>
                <p className="text-slate-400 text-sm">
                  The Free plan is available forever. Pro plan includes a 14-day free trial with full access to all Pro features.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Need help choosing?</h4>
                <p className="text-slate-400 text-sm">
                  Contact our team at support@vlayer.app and we&apos;ll help you find the right plan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
