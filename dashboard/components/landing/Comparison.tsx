export function Comparison() {
  const features = [
    { name: 'HIPAA-specific rules', vlayer: true, snyk: false, vanta: false, drata: false },
    { name: 'Auto-fix engine', vlayer: true, snyk: false, vanta: false, drata: false },
    { name: 'Compliance score', vlayer: true, snyk: false, vanta: true, drata: true },
    { name: 'Developer-first', vlayer: true, snyk: true, vanta: false, drata: false },
    { name: 'CI/CD integration', vlayer: true, snyk: true, vanta: true, drata: true },
    { name: 'Code-level detection', vlayer: true, snyk: true, vanta: false, drata: false },
    { name: 'Price (per month)', vlayer: '$0-199', snyk: '$98-499', vanta: '$3,000+', drata: '$5,000+' },
  ];

  return (
    <section className="bg-gradient-to-b from-[#1E293B] to-[#0F172A] py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Why VLayer?</h2>
          <p className="text-xl text-slate-400">
            The only HIPAA-specific scanner with auto-fix
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Feature</th>
                <th className="px-6 py-4 text-center">
                  <div className="text-sm font-semibold text-emerald-400">VLayer</div>
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-400">Snyk</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-400">Vanta</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-400">Drata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {features.map((feature, index) => (
                <tr key={index} className="hover:bg-slate-800/30">
                  <td className="px-6 py-4 text-sm text-slate-300">{feature.name}</td>
                  <td className="px-6 py-4 text-center">
                    {typeof feature.vlayer === 'boolean' ? (
                      feature.vlayer ? (
                        <svg
                          className="w-5 h-5 text-emerald-500 mx-auto"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-600 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )
                    ) : (
                      <span className="text-sm text-emerald-400 font-semibold">{feature.vlayer}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {typeof feature.snyk === 'boolean' ? (
                      feature.snyk ? (
                        <svg className="w-5 h-5 text-slate-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-600 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )
                    ) : (
                      <span className="text-sm text-slate-400">{feature.snyk}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {typeof feature.vanta === 'boolean' ? (
                      feature.vanta ? (
                        <svg className="w-5 h-5 text-slate-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-600 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )
                    ) : (
                      <span className="text-sm text-slate-400">{feature.vanta}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {typeof feature.drata === 'boolean' ? (
                      feature.drata ? (
                        <svg className="w-5 h-5 text-slate-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-600 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )
                    ) : (
                      <span className="text-sm text-slate-400">{feature.drata}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
