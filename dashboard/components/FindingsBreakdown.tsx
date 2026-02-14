import type { FindingsSummary } from '@/types';

interface FindingsBreakdownProps {
  summary: FindingsSummary;
}

export function FindingsBreakdown({ summary }: FindingsBreakdownProps) {
  const items = [
    { label: 'Critical', value: summary.critical ?? 0, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
    { label: 'High', value: summary.high ?? 0, color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' },
    { label: 'Medium', value: summary.medium ?? 0, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
    { label: 'Low', value: summary.low ?? 0, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
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
    </div>
  );
}
