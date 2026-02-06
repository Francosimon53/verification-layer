export function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Install',
      code: 'npm install -g verification-layer',
      description: 'One command to install globally. Works with Node.js 18+',
    },
    {
      number: '02',
      title: 'Scan',
      code: 'vlayer scan ./your-app',
      description: 'Scans your entire codebase in seconds. Detects 88+ HIPAA violations.',
    },
    {
      number: '03',
      title: 'Fix',
      code: 'vlayer fix --auto',
      description: 'Automatically fixes common issues. Review and commit changes.',
    },
  ];

  return (
    <section className="bg-gradient-to-b from-[#0F172A] to-[#1E293B] py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">How it works</h2>
          <p className="text-xl text-slate-400">Get started in under 5 minutes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-emerald-500/50 to-transparent"></div>
              )}

              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 hover:border-emerald-500/50 transition-all">
                <div className="text-6xl font-bold text-emerald-500/20 mb-4">{step.number}</div>
                <h3 className="text-2xl font-bold text-white mb-3">{step.title}</h3>
                <div className="bg-slate-950 rounded-lg p-4 mb-4 font-mono text-sm text-emerald-400 border border-slate-800">
                  {step.code}
                </div>
                <p className="text-slate-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
