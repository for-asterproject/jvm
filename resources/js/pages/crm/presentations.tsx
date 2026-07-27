import { CrmPageHeader, EmptyState, FormField } from '@/components/crm/crm-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Download, ExternalLink, FileText, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
    if (!bytes) return '';
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
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <CrmPageHeader
                    title="Презентации"
                    description="Общая библиотека файлов и полезных ссылок"
                    actions={
                        canManage ? (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" />
                                Добавить
                            </Button>
                        ) : undefined
                    }
                />

                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск презентации..." className="pl-9" />
                    </div>
                    <select
                        value={type}
                        onChange={(event) => setType(event.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                        <option value="all">Файлы и ссылки</option>
                        <option value="file">Только файлы</option>
                        <option value="link">Только ссылки</option>
                    </select>
                </div>

                {filtered.length === 0 ? (
                    <EmptyState>Презентации не найдены.</EmptyState>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((presentation) => (
                            <Card key={presentation.id} className="gap-4">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                                            {presentation.source_type === 'file' ? <FileText className="size-5" /> : <Link2 className="size-5" />}
                                        </div>
                                        <Badge variant="secondary">{presentation.source_type === 'file' ? 'Файл' : 'Ссылка'}</Badge>
                                    </div>
                                    <CardTitle className="mt-3 leading-snug">{presentation.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    {presentation.description && (
                                        <p className="text-muted-foreground line-clamp-3 text-sm">{presentation.description}</p>
                                    )}
                                    <div className="text-muted-foreground mt-4 space-y-1 text-xs">
                                        {presentation.original_name && <div>{presentation.original_name}</div>}
                                        {presentation.size && <div>{formatSize(presentation.size)}</div>}
                                        <div>
                                            Добавил: {presentation.uploader?.name ?? 'Пользователь'} ·{' '}
                                            {new Date(presentation.created_at).toLocaleDateString('ru-RU')}
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex-wrap gap-2">
                                    {presentation.source_type === 'file' ? (
                                        <Button size="sm" variant="outline" asChild>
                                            <a href={`/presentations/${presentation.id}/download`}>
                                                <Download className="size-4" />
                                                Скачать
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="outline" asChild>
                                            <a href={presentation.url ?? '#'} target="_blank" rel="noreferrer">
                                                <ExternalLink className="size-4" />
                                                Открыть
                                            </a>
                                        </Button>
                                    )}
                                    {canManage && (
                                        <>
                                            <Button size="sm" variant="ghost" onClick={() => openEdit(presentation)}>
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(presentation)}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Редактировать презентацию' : 'Добавить презентацию'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4">
                        <FormField label="Название" required error={errors.title}>
                            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                        </FormField>
                        <FormField label="Описание" error={errors.description}>
                            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                        </FormField>
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
                                <Input
                                    type="file"
                                    accept=".pdf,.ppt,.pptx"
                                    onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })}
                                />
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
                        <p className="text-muted-foreground text-xs">Максимальный размер файла — 25 МБ.</p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
