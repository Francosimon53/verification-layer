'use client';

import type { ComplianceScore } from '@/types';

interface ComplianceGaugeProps {
  score: ComplianceScore;
  size?: 'sm' | 'md' | 'lg';
}

export function ComplianceGauge({ score, size = 'md' }: ComplianceGaugeProps) {
  const { score: value, grade, status } = score;

  // Determine color
  let color = '#dc2626'; // red
  if (value >= 80) color = '#059669'; // green
  else if (value >= 60) color = '#ca8a04'; // yellow

  // Calculate gauge angle (0-180 degrees)
  const angle = (value / 100) * 180;
  const dashArray = (angle / 180) * 251.2;

  const sizes = {
    sm: { width: 150, height: 90, fontSize: '1.5rem', subFontSize: '0.7rem' },
    md: { width: 200, height: 120, fontSize: '2.5rem', subFontSize: '1rem' },
    lg: { width: 300, height: 180, fontSize: '3.5rem', subFontSize: '1.5rem' },
  };

  const dims = sizes[size];

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        className="w-full"
        style={{ maxWidth: dims.width }}
      >
        {/* Background arc */}
        <path
          d={`M ${dims.width * 0.1} ${dims.height * 0.833} A ${dims.width * 0.4} ${dims.width * 0.4} 0 0 1 ${dims.width * 0.9} ${dims.height * 0.833}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={dims.width * 0.1}
          strokeLinecap="round"
        />

        {/* Score arc */}
        <path
          d={`M ${dims.width * 0.1} ${dims.height * 0.833} A ${dims.width * 0.4} ${dims.width * 0.4} 0 0 1 ${dims.width * 0.9} ${dims.height * 0.833}`}
          fill="none"
          stroke={color}
          strokeWidth={dims.width * 0.1}
          strokeLinecap="round"
          strokeDasharray={`${dashArray} 251.2`}
          className="transition-all duration-1000 ease-out"
        />

        {/* Center circle */}
        <circle
          cx={dims.width * 0.5}
          cy={dims.height * 0.833}
          r={dims.width * 0.3}
          fill="white"
          stroke="#f3f4f6"
          strokeWidth="2"
        />

        {/* Score text */}
        <text
          x={dims.width * 0.5}
          y={dims.height * 0.75}
          textAnchor="middle"
          style={{ fontSize: dims.fontSize, fontWeight: 'bold', fill: '#1f2937' }}
        >
          {value}
        </text>
        <text
          x={dims.width * 0.5}
          y={dims.height * 0.917}
          textAnchor="middle"
          style={{ fontSize: dims.subFontSize, fill: '#6b7280' }}
        >
          /100
        </text>
      </svg>

      <div className="mt-2 text-center">
        <div className="text-2xl font-bold text-gray-900">{grade}</div>
        <div className="text-sm text-gray-600 uppercase tracking-wide">{status}</div>
      </div>
    </div>
  );
}
