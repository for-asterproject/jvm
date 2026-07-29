import { cn } from '@/lib/utils';
import { LucideIcon, SearchX, Sparkles } from 'lucide-react';
import { ReactNode } from 'react';

export function CrmPageShell({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('crm-shell relative flex w-full max-w-full min-w-0 flex-1 flex-col overflow-hidden', className)}>
            <div className="pointer-events-none absolute -top-40 -right-32 size-96 rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-500/10" />
            <div className="pointer-events-none absolute top-72 -left-52 size-[30rem] rounded-full bg-cyan-300/10 blur-3xl dark:bg-cyan-500/5" />
            <div className="relative z-10 flex w-full max-w-full min-w-0 flex-1 flex-col gap-6 p-4 md:p-6 xl:p-8">{children}</div>
        </div>
    );
}

export function CrmPageHeader({
    title,
    description,
    actions,
    icon: Icon = Sparkles,
    eyebrow = 'ASTER WORKSPACE',
}: {
    title: string;
    description: string;
    actions?: ReactNode;
    icon?: LucideIcon;
    eyebrow?: string;
}) {
    return (
        <header className="crm-reveal relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,#071a35_0%,#123864_56%,#1e5a91_100%)] px-5 py-6 text-white shadow-[0_24px_70px_-36px_rgba(7,32,68,0.9)] sm:px-7 sm:py-7">
            <div className="pointer-events-none absolute -top-24 right-8 size-52 rounded-full border border-white/10 bg-white/5" />
            <div className="pointer-events-none absolute -right-12 -bottom-28 size-64 rounded-full bg-cyan-300/10 blur-2xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <div className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner shadow-white/10 backdrop-blur">
                        <Icon className="size-6 text-cyan-100" />
                    </div>
                    <div className="min-w-0">
                        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-blue-100/80">
                            <span className="h-px w-5 bg-cyan-200/70" />
                            {eyebrow}
                        </div>
                        <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{title}</h1>
                        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-blue-100/75">{description}</p>
                    </div>
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2 sm:self-center">{actions}</div>}
            </div>
        </header>
    );
}

const statTones = {
    blue: {
        icon: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/20',
        glow: 'from-blue-500/12',
    },
    cyan: {
        icon: 'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-200 dark:ring-cyan-500/20',
        glow: 'from-cyan-500/12',
    },
    emerald: {
        icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/20',
        glow: 'from-emerald-500/12',
    },
    amber: {
        icon: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/20',
        glow: 'from-amber-500/12',
    },
    rose: {
        icon: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/20',
        glow: 'from-rose-500/12',
    },
    violet: {
        icon: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/20',
        glow: 'from-violet-500/12',
    },
};

export function CrmStatsGrid({ children }: { children: ReactNode }) {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function CrmStatCard({
    label,
    value,
    hint,
    icon: Icon,
    tone = 'blue',
}: {
    label: string;
    value: ReactNode;
    hint?: string;
    icon: LucideIcon;
    tone?: keyof typeof statTones;
}) {
    const colors = statTones[tone];

    return (
        <div className="crm-reveal crm-card-hover group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-4 shadow-[0_12px_35px_-28px_rgba(15,45,82,0.8)] backdrop-blur-sm dark:border-white/8 dark:bg-slate-900/75">
            <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent opacity-70', colors.glow)} />
            <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase dark:text-slate-400">{label}</p>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{value}</div>
                    {hint && <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
                </div>
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl ring-1', colors.icon)}>
                    <Icon className="size-5" />
                </div>
            </div>
        </div>
    );
}

export function CrmToolbar({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'crm-reveal rounded-2xl border border-slate-200/70 bg-white/85 p-3 shadow-[0_12px_32px_-28px_rgba(15,45,82,0.8)] backdrop-blur-sm dark:border-white/8 dark:bg-slate-900/75',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function CrmSurface({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'crm-reveal overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_20px_55px_-42px_rgba(15,45,82,0.85)] backdrop-blur-sm dark:border-white/8 dark:bg-slate-900/80',
                className,
            )}
        >
            {children}
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
        <label className={cn('grid gap-1.5 text-sm text-slate-700 dark:text-slate-200', className)}>
            <span className="text-xs font-semibold tracking-wide">
                {label}
                {required && <span className="text-destructive"> *</span>}
            </span>
            {children}
            {error && <span className="text-destructive text-xs">{error}</span>}
        </label>
    );
}

export function EmptyState({ children, title = 'Здесь пока пусто' }: { children: ReactNode; title?: string }) {
    return (
        <CrmSurface className="flex min-h-64 items-center justify-center border-dashed bg-white/60 p-10 text-center dark:bg-slate-900/50">
            <div className="max-w-sm">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/20">
                    <SearchX className="size-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{children}</p>
            </div>
        </CrmSurface>
    );
}

export function CrmAvatar({ name, className }: { name: string; className?: string }) {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    return (
        <span
            title={name}
            className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#173f70,#2f6da8)] text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-900',
                className,
            )}
        >
            {initials || 'A'}
        </span>
    );
}

export function CrmAvatarStack({ names, limit = 3 }: { names: string[]; limit?: number }) {
    const visible = names.slice(0, limit);
    const rest = Math.max(0, names.length - visible.length);

    return (
        <div className="flex items-center -space-x-2">
            {visible.map((name, index) => (
                <CrmAvatar key={`${name}-${index}`} name={name} className="size-7 rounded-lg" />
            ))}
            {rest > 0 && (
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-900">
                    +{rest}
                </span>
            )}
        </div>
    );
}

export function CrmFormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return (
        <section className="grid gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-white/8 dark:bg-white/[0.025]">
            <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
                {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
            </div>
            {children}
        </section>
    );
}
