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

          {/* Proven Results */}
          <div className="mt-20 mb-16">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-white">Proven Results</h2>
              <p className="text-slate-400 mt-2">Real data from scanning open-source healthcare repositories</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl text-center">
                <div className="text-3xl font-bold text-emerald-400">13-15</div>
                <div className="text-sm text-slate-400 mt-1">HIPAA violations<br />found per scan</div>
              </div>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl text-center">
                <div className="text-3xl font-bold text-emerald-400">584ms</div>
                <div className="text-sm text-slate-400 mt-1">Average<br />scan time</div>
              </div>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl text-center">
                <div className="text-3xl font-bold text-emerald-400">0%</div>
                <div className="text-sm text-slate-400 mt-1">False positive<br />rate</div>
              </div>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl text-center">
                <div className="text-3xl font-bold text-emerald-400">28</div>
                <div className="text-sm text-slate-400 mt-1">Total findings across<br />2 external repos</div>
              </div>
            </div>
          </div>

          {/* Case Study */}
          <div className="mb-16">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-700">
                <h3 className="text-2xl font-bold text-white">Case Study: Real-World Healthcare Apps</h3>
                <p className="text-slate-400 mt-1">We scanned 2 open-source healthcare applications built with Next.js</p>
              </div>

              <div className="px-8 py-6">
                {/* Severity Breakdown */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="text-sm text-slate-300"><span className="font-bold text-white">11</span> Critical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                    <span className="text-sm text-slate-300"><span className="font-bold text-white">11</span> High</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="text-sm text-slate-300"><span className="font-bold text-white">6</span> Medium</span>
                  </div>
                </div>

                {/* Severity bar */}
                <div className="w-full h-3 rounded-full overflow-hidden flex mb-8">
                  <div className="bg-red-500 h-full" style={{ width: '39.3%' }} />
                  <div className="bg-orange-500 h-full" style={{ width: '39.3%' }} />
                  <div className="bg-amber-500 h-full" style={{ width: '21.4%' }} />
                </div>

                {/* Real findings */}
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Real Findings Detected</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold text-white bg-red-500/20 border border-red-500/30">CRITICAL</span>
                    </div>
                    <h5 className="font-medium text-white text-sm">Secrets exposed to client via NEXT_PUBLIC_ prefix</h5>
                    <p className="text-xs text-slate-500 mt-1">45 CFR &sect;164.312(a)(1) &mdash; Access Control</p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold text-white bg-red-500/20 border border-red-500/30">CRITICAL</span>
                    </div>
                    <h5 className="font-medium text-white text-sm">PHI data in error logs</h5>
                    <p className="text-xs text-slate-500 mt-1">45 CFR &sect;164.312(b) &mdash; Audit Controls</p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold text-white bg-orange-500/20 border border-orange-500/30">HIGH</span>
                    </div>
                    <h5 className="font-medium text-white text-sm">No audit logging framework detected</h5>
                    <p className="text-xs text-slate-500 mt-1">45 CFR &sect;164.312(b) &mdash; Audit Controls</p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold text-white bg-amber-500/20 border border-amber-500/30">MEDIUM</span>
                    </div>
                    <h5 className="font-medium text-white text-sm">Hardcoded admin access flag</h5>
                    <p className="text-xs text-slate-500 mt-1">45 CFR &sect;164.312(a)(1) &mdash; Access Control</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof Quote */}
          <div className="mb-16">
            <div className="bg-gradient-to-br from-emerald-500/5 to-teal-600/5 rounded-xl p-8 border border-emerald-500/20">
              <div className="max-w-3xl mx-auto text-center">
                <svg className="w-10 h-10 text-emerald-500/40 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <blockquote className="text-lg text-slate-300 leading-relaxed mb-4">
                  VLayer found critical HIPAA violations in under 1 second that would have taken a manual audit weeks to identify &mdash; including API keys exposed to the browser and patient data leaking into error logs.
                </blockquote>
                <div className="text-sm text-slate-500">Real results from scanning production healthcare codebases</div>
              </div>
            </div>
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
