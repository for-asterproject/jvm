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
import { Head, router } from '@inertiajs/react';
import { CloudUpload, Database, Download, ExternalLink, FileStack, FileText, FolderOpen, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { FormErrors, PresentationRecord } from './types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Презентации', href: '/presentations' }];

const makeEmptyForm = () => ({
    title: '',
    description: '',
    source_type: 'file' as 'file' | 'link',
    url: '',
    file: null as File | null,
});

const formatSize = (bytes: number | null) => {
    if (!bytes) return '0 КБ';
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
};

export default function Presentations({ presentations, canManage }: { presentations: PresentationRecord[]; canManage: boolean }) {
    const [query, setQuery] = useState('');
    const [type, setType] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<PresentationRecord | null>(null);
    const [form, setForm] = useState(makeEmptyForm);
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return presentations.filter((presentation) => {
            const matchesType = type === 'all' || presentation.source_type === type;
            const matchesQuery =
                !needle ||
                `${presentation.title} ${presentation.description ?? ''} ${presentation.original_name ?? ''}`.toLowerCase().includes(needle);
            return matchesType && matchesQuery;
        });
    }, [presentations, query, type]);

    const fileCount = presentations.filter((presentation) => presentation.source_type === 'file').length;
    const linkCount = presentations.length - fileCount;
    const totalSize = presentations.reduce((total, presentation) => total + (presentation.size ?? 0), 0);

    const openCreate = () => {
        setEditing(null);
        setForm(makeEmptyForm());
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (presentation: PresentationRecord) => {
        setEditing(presentation);
        setForm({
            title: presentation.title,
            description: presentation.description ?? '',
            source_type: presentation.source_type,
            url: presentation.url ?? '',
            file: null,
        });
        setErrors({});
        setDialogOpen(true);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        const payload = editing ? { ...form, _method: 'put' } : form;
        router.post(editing ? `/presentations/${editing.id}` : '/presentations', payload, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => setDialogOpen(false),
            onError: (responseErrors) => setErrors(responseErrors as FormErrors),
            onFinish: () => setProcessing(false),
        });
    };

    const remove = (presentation: PresentationRecord) => {
        if (!window.confirm(`Удалить презентацию «${presentation.title}»?`)) return;
        router.delete(`/presentations/${presentation.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Презентации" />
            <CrmPageShell>
                <CrmPageHeader
                    title="Презентации"
                    description="Материалы команды, коммерческие презентации и полезные ресурсы"
                    icon={FolderOpen}
                    eyebrow="ASTER · LIBRARY"
                    actions={
                        canManage ? (
                            <Button onClick={openCreate} className="bg-white text-[#123864] shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                                <Plus className="size-4" />
                                Новый материал
                            </Button>
                        ) : undefined
                    }
                />

                <CrmStatsGrid>
                    <CrmStatCard label="Все материалы" value={presentations.length} hint="В общей библиотеке" icon={FileStack} tone="blue" />
                    <CrmStatCard label="Файлы" value={fileCount} hint="PDF и PowerPoint" icon={FileText} tone="violet" />
                    <CrmStatCard label="Ссылки" value={linkCount} hint="Внешние ресурсы" icon={Link2} tone="cyan" />
                    <CrmStatCard label="Объём файлов" value={formatSize(totalSize)} hint="Приватное хранилище" icon={Database} tone="emerald" />
                </CrmStatsGrid>

                <CrmToolbar>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Найти презентацию или файл..."
                                className="border-slate-200 bg-slate-50/80 pl-9 shadow-none focus-visible:bg-white dark:border-white/10 dark:bg-white/5"
                            />
                        </div>
                        <select
                            value={type}
                            onChange={(event) => setType(event.target.value)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Файлы и ссылки</option>
                            <option value="file">Только файлы</option>
                            <option value="link">Только ссылки</option>
                        </select>
                        <div className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                            Показано: <span className="font-semibold text-slate-800 dark:text-slate-200">{filtered.length}</span>
                        </div>
                    </div>
                </CrmToolbar>

                {filtered.length === 0 ? (
                    <EmptyState title="Материалы не найдены">Добавьте презентацию или измените параметры поиска.</EmptyState>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {filtered.map((presentation) => (
                            <CrmSurface key={presentation.id} className="crm-card-hover group flex min-h-72 flex-col">
                                <div
                                    className={
                                        presentation.source_type === 'file'
                                            ? 'relative overflow-hidden border-b border-blue-100 bg-[linear-gradient(135deg,#eff6ff,#eef2ff)] p-5 dark:border-blue-500/10 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(79,70,229,0.08))]'
                                            : 'relative overflow-hidden border-b border-cyan-100 bg-[linear-gradient(135deg,#ecfeff,#eff6ff)] p-5 dark:border-cyan-500/10 dark:bg-[linear-gradient(135deg,rgba(6,182,212,0.1),rgba(37,99,235,0.08))]'
                                    }
                                >
                                    <div className="pointer-events-none absolute -top-10 -right-8 size-28 rounded-full border border-white/60 bg-white/25 dark:border-white/5 dark:bg-white/[0.02]" />
                                    <div className="relative flex items-start justify-between">
                                        <div
                                            className={
                                                presentation.source_type === 'file'
                                                    ? 'flex size-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                    : 'flex size-12 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                                            }
                                        >
                                            {presentation.source_type === 'file' ? <FileText className="size-6" /> : <Link2 className="size-6" />}
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="border-white/70 bg-white/70 text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                                        >
                                            {presentation.source_type === 'file' ? 'Файл' : 'Ссылка'}
                                        </Badge>
                                    </div>
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
                                                    {new Date(presentation.created_at).toLocaleDateString('ru-RU')}
                                                    {presentation.size ? ` · ${formatSize(presentation.size)}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 border-t border-slate-100 px-4 py-3 dark:border-white/6">
                                    {presentation.source_type === 'file' ? (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="flex-1 justify-start text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-500/10"
                                            asChild
                                        >
                                            <a href={`/presentations/${presentation.id}/download`}>
                                                <Download className="size-4" />
                                                Скачать
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="flex-1 justify-start text-cyan-700 hover:bg-cyan-50 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                                            asChild
                                        >
                                            <a href={presentation.url ?? '#'} target="_blank" rel="noreferrer">
                                                <ExternalLink className="size-4" />
                                                Открыть
                                            </a>
                                        </Button>
                                    )}
                                    {canManage && (
                                        <>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-8 text-slate-400 hover:text-blue-700"
                                                onClick={() => openEdit(presentation)}
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                                onClick={() => remove(presentation)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CrmSurface>
                        ))}
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
                            <DialogTitle>{editing ? 'Редактировать материал' : 'Добавить материал'}</DialogTitle>
                        </div>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4 px-6 pb-6">
                        <CrmFormSection title="Описание материала">
                            <FormField label="Название" required error={errors.title}>
                                <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                            </FormField>
                            <FormField label="Описание" error={errors.description}>
                                <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                            </FormField>
                        </CrmFormSection>
                        <CrmFormSection title="Источник" description="Загрузите документ или укажите внешнюю ссылку">
                            <FormField label="Тип" required error={errors.source_type}>
                                <select
                                    value={form.source_type}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            source_type: event.target.value as 'file' | 'link',
                                            file: null,
                                            url: '',
                                        })
                                    }
                                    className="border-input bg-background h-9 rounded-md border px-3"
                                >
                                    <option value="file">Файл PDF/PPT/PPTX</option>
                                    <option value="link">Внешняя ссылка</option>
                                </select>
                            </FormField>
                            {form.source_type === 'file' ? (
                                <FormField
                                    label={editing?.source_type === 'file' ? 'Новый файл (необязательно)' : 'Файл'}
                                    required={!editing || editing.source_type !== 'file'}
                                    error={errors.file}
                                >
                                    <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 px-5 py-7 text-center transition hover:border-blue-400 hover:bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/5 dark:hover:bg-blue-500/10">
                                        <input
                                            type="file"
                                            accept=".pdf,.ppt,.pptx"
                                            className="sr-only"
                                            onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })}
                                        />
                                        <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/20">
                                            <CloudUpload className="size-5" />
                                        </span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            {form.file?.name ?? editing?.original_name ?? 'Выберите файл'}
                                        </span>
                                        <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF, PPT или PPTX · до 25 МБ</span>
                                    </label>
                                </FormField>
                            ) : (
                                <FormField label="Ссылка" required error={errors.url}>
                                    <Input
                                        type="url"
                                        placeholder="https://..."
                                        value={form.url}
                                        onChange={(event) => setForm({ ...form, url: event.target.value })}
                                    />
                                </FormField>
                            )}
                        </CrmFormSection>
                        <DialogFooter className="mt-1 border-t border-slate-100 pt-4 dark:border-white/8">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing} className="bg-[#123864] text-white hover:bg-[#0d2d52]">
                                {processing ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
