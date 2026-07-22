import { LucideIcon } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('w-full', className)}>
      <Card className="w-full rounded-2xl border-dashed py-8 shadow-sm">
        <CardHeader className="items-center px-6 text-center sm:px-10">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl font-semibold leading-snug sm:text-2xl">
            {title}
          </CardTitle>
          <CardDescription className="max-w-prose text-base leading-relaxed">
            {description}
          </CardDescription>
          {action && <div className="mt-6 w-full sm:w-auto">{action}</div>}
        </CardHeader>
      </Card>
    </div>
  );
}
