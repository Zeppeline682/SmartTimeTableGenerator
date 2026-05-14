interface StatusBadgeProps {
  status: 'live' | 'draft' | 'active' | 'absent' | 'success' | 'error' | 'warning';
  children: React.ReactNode;
  showIndicator?: boolean;
}

export function StatusBadge({ status, children, showIndicator = false }: StatusBadgeProps) {
  const getColors = () => {
    switch (status) {
      case 'live':
      case 'active':
      case 'success':
        return {
          bg: 'var(--status-green)',
          text: 'white',
        };
      case 'warning':
        return {
          bg: 'var(--status-orange)',
          text: 'white',
        };
      case 'error':
      case 'absent':
        return {
          bg: 'var(--status-red)',
          text: 'white',
        };
      case 'draft':
      default:
        return {
          bg: 'var(--muted)',
          text: 'var(--muted-foreground)',
        };
    }
  };

  const colors = getColors();

  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {showIndicator && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: colors.text }}
        />
      )}
      {children}
    </span>
  );
}


