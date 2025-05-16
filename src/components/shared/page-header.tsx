import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  children?: React.ReactNode; // For action buttons etc.
}

export function PageHeader({ title, description, children, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden", className)} {...props}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex flex-shrink-0 gap-2">{children}</div>}
    </div>
  );
}
