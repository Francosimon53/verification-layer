'use client';

interface CircularProgressProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function CircularProgress({ score, size = 160, strokeWidth = 12, showLabel = true }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  // Determine color based on score
  let color = '#ef4444'; // red
  let gradient = 'from-red-500 to-red-600';
  if (score >= 90) {
    color = '#10b981'; // emerald
    gradient = 'from-emerald-500 to-teal-500';
  } else if (score >= 80) {
    color = '#22c55e'; // green
    gradient = 'from-green-500 to-emerald-500';
  } else if (score >= 70) {
    color = '#f59e0b'; // amber
    gradient = 'from-amber-500 to-orange-500';
  } else if (score >= 60) {
    color = '#f97316'; // orange
    gradient = 'from-orange-500 to-red-500';
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-slate-800"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))',
          }}
        />
      </svg>

      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-4xl font-bold bg-gradient-to-br ${gradient} bg-clip-text text-transparent`}>
            {score}
          </div>
          <div className="text-sm text-slate-400 mt-1">/ 100</div>
        </div>
      )}
    </div>
  );
}
