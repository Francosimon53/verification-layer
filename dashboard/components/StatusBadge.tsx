interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const styles: Record<string, string> = {
  compliant: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  excellent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  good: 'bg-green-500/10 text-green-400 border-green-500/20',
  at_risk: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'at-risk': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  fair: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  poor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  scanning: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
};

const labels: Record<string, string> = {
  compliant: 'Compliant',
  excellent: 'Excellent',
  good: 'Good',
  at_risk: 'At Risk',
  'at-risk': 'At Risk',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
  pending: 'Pending',
  scanning: 'Scanning...',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md border ${styles[status] || styles.pending} ${sizeClasses[size]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
      {labels[status] || status}
    </span>
  );
}
