'use client';

import { useState } from 'react';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleProUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingPeriod: 'monthly' }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Error creating checkout session. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error starting checkout. Please try again.');
      setLoading(false);
    }
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:sales@vlayer.app';
  };

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for individual developers and small projects',
      features: [
        'Unlimited projects',
        'Basic compliance scanning',
        '163+ detection rules',
        'Community support',
        'Basic reports (JSON/MD)',
      ],
      cta: 'Current Plan',
      disabled: true,
      onClick: undefined,
    },
    {
      name: 'Pro',
      price: '$49',
      period: '/month',
      description: 'For teams building healthcare applications',
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
      cta: loading ? 'Loading...' : 'Start Free Trial',
      highlighted: true,
      disabled: loading,
      onClick: handleProUpgrade,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For organizations with advanced needs',
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
      cta: 'Contact Sales',
      disabled: false,
      onClick: handleContactSales,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A]">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border shadow-xl ${
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
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-slate-400">{plan.period}</span>}
                  </div>
                  <p className="text-slate-400 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-300">
                      <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              </div>
            ))}
          </div>

          {/* FAQ or Additional Info */}
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
                  The Free plan is available forever. Pro plan includes a 14-day free trial, no credit card required.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Need help choosing?</h4>
                <p className="text-slate-400 text-sm">
                  Contact our team at support@vlayer.app and we'll help you find the right plan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
