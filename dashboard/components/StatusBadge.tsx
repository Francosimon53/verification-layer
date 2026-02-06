interface StatusBadgeProps {
  status: 'compliant' | 'at-risk' | 'critical' | 'excellent' | 'good' | 'fair' | 'poor';
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const styles = {
    compliant: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    excellent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    good: 'bg-green-500/10 text-green-400 border-green-500/20',
    'at-risk': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    fair: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    poor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const labels = {
    compliant: 'Compliant',
    excellent: 'Excellent',
    good: 'Good',
    'at-risk': 'At Risk',
    fair: 'Fair',
    poor: 'Poor',
    critical: 'Critical',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md border ${styles[status]} ${sizeClasses[size]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
      {labels[status]}
    </span>
  );
}
