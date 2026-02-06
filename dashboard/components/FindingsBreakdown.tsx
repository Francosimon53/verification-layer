import type { ComplianceScore } from '@/types';

interface FindingsBreakdownProps {
  score: ComplianceScore;
}

export function FindingsBreakdown({ score }: FindingsBreakdownProps) {
  const { breakdown } = score;

  const items = [
    { label: 'Critical', value: breakdown.critical, color: 'text-red-600', bgColor: 'bg-red-50' },
    { label: 'High', value: breakdown.high, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { label: 'Medium', value: breakdown.medium, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: 'Low', value: breakdown.low, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Findings Breakdown</h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className={`${item.bgColor} rounded-lg p-4 text-center`}>
            <div className="text-sm text-gray-600 mb-1">{item.label}</div>
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {breakdown.acknowledged > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-900">
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
