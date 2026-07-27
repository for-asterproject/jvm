import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export function CrmPageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
    );
}

export function FormField({
    label,
    error,
    required,
    children,
    className,
}: {
    label: string;
    error?: string;
    required?: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <label className={cn('grid gap-1.5 text-sm', className)}>
            <span className="font-medium">
                {label}
                {required && <span className="text-destructive"> *</span>}
            </span>
            {children}
            {error && <span className="text-destructive text-xs">{error}</span>}
        </label>
    );
}

export function EmptyState({ children }: { children: ReactNode }) {
    return <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">{children}</div>;
}
