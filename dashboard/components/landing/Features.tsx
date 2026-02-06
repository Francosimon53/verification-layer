export function Features() {
  const features = [
    {
      icon: '🔍',
      title: '88+ Detection Rules',
      description: 'Comprehensive scanning for PHI exposure, encryption, access control, audit logging, and data retention.',
    },
    {
      icon: '⚡',
      title: 'Auto-Fix Engine',
      description: 'Automatically remediate 13 types of violations with one command. SQL injection, hardcoded secrets, and more.',
    },
    {
      icon: '🔄',
      title: 'CI/CD Integration',
      description: 'GitHub Actions, GitLab CI, Jenkins support. Block commits with critical HIPAA violations.',
    },
    {
      icon: '🤖',
      title: 'AI-Powered Analysis',
      description: 'Semantic context analysis reduces false positives by 70%. Understands test files vs production code.',
    },
    {
      icon: '📊',
      title: 'Compliance Score',
      description: '0-100 score with letter grades. Track compliance trends over time. Weighted by severity.',
    },
    {
      icon: '📄',
      title: 'Auditor Reports',
      description: 'Generate PDF reports with SHA256 hash verification. Evidence for SOC 2 and HITRUST audits.',
    },
  ];

  return (
    <section className="bg-[#0F172A] py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Everything you need for HIPAA compliance
          </h2>
          <p className="text-xl text-slate-400">
            From development to production, we've got you covered
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 hover:border-emerald-500/50 transition-all group"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
