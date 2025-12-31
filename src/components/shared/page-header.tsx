import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  children?: React.ReactNode; // For action buttons etc.
}

export function PageHeader({ title, description, children, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden", className)} {...props}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>}
      </div>
      {children && <div className="flex flex-shrink-0 gap-2">{children}</div>}
    </div>
  );
}
