import {
    CrmAvatar,
    CrmFormSection,
    CrmPageHeader,
    CrmPageShell,
    CrmStatCard,
    CrmStatsGrid,
    CrmSurface,
    CrmToolbar,
    EmptyState,
    FormField,
} from '@/components/crm/crm-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Database, FileImage, FileStack, Film, FolderOpen, Link2, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { FormErrors, PresentationLimits, PresentationRecord } from './types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Презентации', href: '/presentations' }];

const makeEmptyForm = () => ({
    title: '',
    description: '',
});

const formatSize = (bytes: number) => {
    if (!bytes) return '0 КБ';
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
};

export default function Presentations({
    presentations,
    canManage,
    limits,
}: {
    presentations: PresentationRecord[];
    canManage: boolean;
    limits: PresentationLimits;
}) {
    const [query, setQuery] = useState('');
    const [type, setType] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState(makeEmptyForm);
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return presentations.filter((presentation) => {
            const matchesType = type === 'all' || presentation.attachments.some((attachment) => attachment.media_type === type);
            const attachmentNames = presentation.attachments.map((attachment) => attachment.display_name).join(' ');
            const matchesQuery =
                !needle || `${presentation.title} ${presentation.description ?? ''} ${attachmentNames}`.toLowerCase().includes(needle);

            return matchesType && matchesQuery;
        });
    }, [presentations, query, type]);

    const attachments = presentations.flatMap((presentation) => presentation.attachments);
    const fileCount = attachments.filter((attachment) => attachment.kind === 'file').length;
    const linkCount = attachments.filter((attachment) => attachment.kind === 'link').length;
    const totalSize = presentations.reduce((total, presentation) => total + presentation.total_size, 0);

    const openCreate = () => {
        setForm(makeEmptyForm());
        setErrors({});
        setDialogOpen(true);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post('/presentations', form, {
            preserveScroll: true,
            onError: (responseErrors) => setErrors(responseErrors as FormErrors),
            onFinish: () => setProcessing(false),
        });
    };

    const remove = (presentation: PresentationRecord) => {
        if (!window.confirm(`Удалить презентацию «${presentation.title}» и все её материалы?`)) return;
        router.delete(`/presentations/${presentation.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Презентации" />
            <CrmPageShell>
                <CrmPageHeader
                    title="Презентации"
                    description={`Коллекции фото, видео, документов и ссылок · до ${limits.max_attachments} материалов`}
                    icon={FolderOpen}
                    eyebrow="ASTER · LIBRARY"
                    actions={
                        canManage ? (
                            <Button onClick={openCreate} className="bg-white text-[#123864] shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                                <Plus className="size-4" />
                                Новая презентация
                            </Button>
                        ) : undefined
                    }
                />

                <CrmStatsGrid>
                    <CrmStatCard label="Презентации" value={presentations.length} hint="В общей библиотеке" icon={FileStack} tone="blue" />
                    <CrmStatCard label="Файлы" value={fileCount} hint="Документы и медиа" icon={FileImage} tone="violet" />
                    <CrmStatCard label="Ссылки" value={linkCount} hint="Внешние материалы" icon={Link2} tone="cyan" />
                    <CrmStatCard label="Объём файлов" value={formatSize(totalSize)} hint="Приватное хранилище" icon={Database} tone="emerald" />
                </CrmStatsGrid>

                <CrmToolbar>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Найти презентацию или материал..."
                                className="border-slate-200 bg-slate-50/80 pl-9 shadow-none focus-visible:bg-white dark:border-white/10 dark:bg-white/5"
                            />
                        </div>
                        <select
                            value={type}
                            onChange={(event) => setType(event.target.value)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Все материалы</option>
                            <option value="image">Фото</option>
                            <option value="video">Видео</option>
                            <option value="document">Документы</option>
                            <option value="archive">Архивы</option>
                            <option value="link">Ссылки</option>
                        </select>
                        <div className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                            Показано: <span className="font-semibold text-slate-800 dark:text-slate-200">{filtered.length}</span>
                        </div>
                    </div>
                </CrmToolbar>

                {filtered.length === 0 ? (
                    <EmptyState title="Презентации не найдены">Добавьте презентацию или измените параметры поиска.</EmptyState>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {filtered.map((presentation) => {
                            const cover = presentation.attachments.find((attachment) => attachment.media_type === 'image' && attachment.view_url);
                            const hasVideo = presentation.attachments.some((attachment) => attachment.media_type === 'video');

                            return (
                                <CrmSurface key={presentation.id} className="crm-card-hover group flex min-h-80 flex-col overflow-hidden">
                                    <div className="relative h-36 overflow-hidden border-b border-blue-100 bg-[linear-gradient(135deg,#eff6ff,#eef2ff)] dark:border-blue-500/10">
                                        {cover?.view_url ? (
                                            <img
                                                src={cover.view_url}
                                                alt=""
                                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-blue-600 dark:text-blue-300">
                                                {hasVideo ? <Film className="size-12" /> : <FileStack className="size-12" />}
                                            </div>
                                        )}
                                        <Badge className="absolute top-3 right-3 border-white/70 bg-white/85 text-slate-700 shadow-sm">
                                            {presentation.attachments_count}/{limits.max_attachments}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-1 flex-col p-5">
                                        <h3 className="line-clamp-2 text-base leading-snug font-semibold text-slate-900 dark:text-white">
                                            {presentation.title}
                                        </h3>
                                        {presentation.description && (
                                            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                                {presentation.description}
                                            </p>
                                        )}
                                        <div className="mt-auto pt-5">
                                            <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-white/6">
                                                <CrmAvatar name={presentation.uploader?.name ?? 'Пользователь'} className="size-7 rounded-lg" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                                                        {presentation.uploader?.name ?? 'Пользователь'}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        {new Date(presentation.created_at).toLocaleDateString('ru-RU')} ·{' '}
                                                        {formatSize(presentation.total_size)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-white/6">
                                        <Button asChild size="sm" className="flex-1 bg-[#123864] text-white hover:bg-[#0d2d52]">
                                            <Link href={`/presentations/${presentation.id}`}>
                                                <FolderOpen className="size-4" />
                                                Открыть
                                            </Link>
                                        </Button>
                                        {canManage && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                                onClick={() => remove(presentation)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CrmSurface>
                            );
                        })}
                    </div>
                )}
            </CrmPageShell>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="border-slate-200/70 bg-white/95 p-0 sm:max-w-xl dark:border-white/10 dark:bg-slate-950/95">
                    <DialogHeader>
                        <div className="border-b border-slate-100 px-6 py-5 dark:border-white/8">
                            <div className="mb-1 text-[10px] font-semibold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-300">
                                ASTER · LIBRARY
                            </div>
                            <DialogTitle>Новая презентация</DialogTitle>
                        </div>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4 px-6 pb-6">
                        <CrmFormSection title="Описание" description="После сохранения можно добавить до 10 файлов и ссылок">
                            <FormField label="Название" required error={errors.title}>
                                <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                            </FormField>
                            <FormField label="Описание" error={errors.description}>
                                <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                            </FormField>
                        </CrmFormSection>
                        <DialogFooter className="mt-1 border-t border-slate-100 pt-4 dark:border-white/8">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing} className="bg-[#123864] text-white hover:bg-[#0d2d52]">
                                {processing ? 'Создание...' : 'Создать и добавить материалы'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
