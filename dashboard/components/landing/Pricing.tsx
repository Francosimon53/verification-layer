export function Pricing() {
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for side projects and learning',
      features: [
        '88 detection rules',
        '5 auto-fixes',
        'CLI only',
        'JSON reports',
        'Community support',
      ],
      cta: 'Start Free',
      highlighted: false,
    },
    {
      name: 'Starter',
      price: '$19',
      period: 'per month',
      description: 'For small teams and startups',
      features: [
        'All detection rules',
        '13 auto-fixes',
        'Baseline support',
        'HTML & PDF reports',
        'Email support',
        'GitHub Actions',
      ],
      cta: 'Start Trial',
      highlighted: true,
    },
    {
      name: 'Pro',
      price: '$49',
      period: 'per month',
      description: 'For growing healthcare companies',
      features: [
        'AI-powered custom rules',
        'Web dashboard',
        'Multi-project management',
        'Score history & trends',
        'Priority support',
        'VS Code extension',
      ],
      cta: 'Start Trial',
      highlighted: false,
    },
    {
      name: 'Enterprise',
      price: '$199',
      period: 'per month',
      description: 'For large organizations',
      features: [
        'Custom rules engine',
        'SSO & SAML',
        'On-premise deployment',
        'SLA guarantee',
        'Dedicated support',
        'Training & onboarding',
      ],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  return (
    <section className="bg-[#0F172A] py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-slate-400">Start free, scale as you grow</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`relative rounded-xl p-6 ${
                tier.highlighted
                  ? 'bg-gradient-to-b from-emerald-500/10 to-teal-500/10 border-2 border-emerald-500'
                  : 'bg-slate-900/50 border border-slate-800'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-1 rounded-full text-white text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                  <span className="text-slate-400">/ {tier.period}</span>
                </div>
                <p className="text-sm text-slate-400">{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-6">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <svg
                      className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  tier.highlighted
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-400 mt-8 text-sm">
          All plans include unlimited scans. 14-day money-back guarantee.
        </p>
      </div>
    </section>
  );
}
