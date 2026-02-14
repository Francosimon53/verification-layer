'use client';

interface DonutChartProps {
  score: number;
  grade: string;
  hasData: boolean;
  size?: number;
}

export function DonutChart({ score, grade, hasData, size = 80 }: DonutChartProps) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = hasData ? circumference - (score / 100) * circumference : circumference;

  let strokeColor = '#475569'; // slate-600 for no data
  if (hasData) {
    if (score >= 90) strokeColor = '#10b981'; // emerald-500
    else if (score >= 70) strokeColor = '#f59e0b'; // amber-500
    else strokeColor = '#ef4444'; // red-500
  }

  let scoreColor = 'text-slate-500';
  if (hasData) {
    if (score >= 90) scoreColor = 'text-emerald-400';
    else if (score >= 70) scoreColor = 'text-amber-400';
    else scoreColor = 'text-red-400';
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: hasData ? `drop-shadow(0 0 4px ${strokeColor}40)` : undefined,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${scoreColor}`}>
          {hasData ? score : '--'}
        </span>
        <span className="text-[10px] text-slate-500 -mt-0.5">
          {hasData ? grade : 'N/A'}
        </span>
      </div>
    </div>
  );
}
