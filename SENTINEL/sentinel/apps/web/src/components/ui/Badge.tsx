import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { getSeverityColor, getStatusColor, getRiskClassColor } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'severity' | 'status' | 'risk-class';
  value?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', value, children, ...props }, ref) => {
    let variantClass = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

    switch (variant) {
      case 'severity':
        variantClass += ` ${getSeverityColor(value || '')}`;
        break;
      case 'status':
        variantClass += ` ${getStatusColor(value || '')}`;
        break;
      case 'risk-class':
        variantClass += ` ${getRiskClassColor(value || '')}`;
        break;
      default:
        variantClass += ' bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    }

    return (
      <span ref={ref} className={cn(variantClass, className)} {...props}>
        {children || value}
      </span>
    );
  }
);

Badge.displayName = 'Badge';