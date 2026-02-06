import type { ComplianceScore } from '@/types';

interface FindingsBreakdownProps {
  score: ComplianceScore;
}

export function FindingsBreakdown({ score }: FindingsBreakdownProps) {
  const { breakdown } = score;

  const items = [
    { label: 'Critical', value: breakdown.critical, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
    { label: 'High', value: breakdown.high, color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' },
    { label: 'Medium', value: breakdown.medium, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
    { label: 'Low', value: breakdown.low, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Findings Breakdown</h3>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label} className={`${item.bgColor} border ${item.borderColor} rounded-lg p-4 text-center`}>
            <div className="text-sm text-slate-400 mb-2">{item.label}</div>
            <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {breakdown.acknowledged > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center gap-3 text-sm text-blue-300">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>{breakdown.acknowledged} finding(s) acknowledged (25% penalty reduction)</span>
        </div>
      )}
    </div>
  );
}
