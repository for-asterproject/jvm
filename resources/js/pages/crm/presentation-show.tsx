import { CrmFormSection, CrmPageHeader, CrmPageShell, CrmSurface, EmptyState, FormField } from '@/components/crm/crm-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import Uppy from '@uppy/core';
import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';
import ruRU from '@uppy/locales/lib/ru_RU';
import Dashboard from '@uppy/react/dashboard';
import axios from 'axios';
import {
    ArrowLeft,
    Download,
    ExternalLink,
    FileArchive,
    FileText,
    Film,
    FolderOpen,
    GripVertical,
    Image as ImageIcon,
    Link2,
    Pencil,
    Play,
    Plus,
    Trash2,
} from 'lucide-react';
import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { FormErrors, PresentationAttachmentRecord, PresentationLimits, PresentationRecord } from './types';

interface UploadMeta extends Record<string, unknown> {
    attachmentId?: number;
}

type UploadBody = Record<string, unknown>;

const formatSize = (bytes: number) => {
    if (!bytes) return '0 КБ';
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
};

const errorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
        const errors = error.response?.data?.errors as Record<string, string[] | string> | undefined;
        const firstError = errors ? Object.values(errors)[0] : null;

        if (Array.isArray(firstError)) return firstError[0];
        if (typeof firstError === 'string') return firstError;
        if (typeof error.response?.data?.message === 'string') return error.response.data.message;
    }

    return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
};

const createUploader = (presentationId: number, limits: PresentationLimits) => {
    const uppy = new Uppy<UploadMeta, UploadBody>({
        id: `presentation-${presentationId}`,
        autoProceed: false,
        allowMultipleUploadBatches: true,
        locale: ruRU,
        restrictions: {
            maxFileSize: limits.max_file_size,
            maxTotalFileSize: limits.max_total_size,
            maxNumberOfFiles: limits.max_attachments,
            allowedFileTypes: limits.allowed_extensions.map((extension) => `.${extension}`),
        },
    });

    const controllers = new Map<string, AbortController>();

    const uploadFile = async (fileID: string) => {
        const file = uppy.getFile(fileID);
        const controller = new AbortController();
        controllers.set(fileID, controller);

        try {
            if (!(file.data instanceof Blob) || !file.size) {
                throw new Error('Не удалось прочитать выбранный файл.');
            }

            const { data } = await axios.post(
                `/presentations/${presentationId}/uploads`,
                {
                    name: file.name,
                    size: file.size,
                    mime_type: file.type,
                    last_modified: file.data instanceof File ? file.data.lastModified : null,
                },
                { signal: controller.signal },
            );
            const attachmentId = Number(data.attachment_id);
            const chunkSize = Number(data.chunk_size);
            const totalChunks = Number(data.total_chunks);
            const uploadedChunks = new Set<number>((data.uploaded_chunks as number[]).map(Number));
            const uploadedBeforeStart = [...uploadedChunks].reduce(
                (total, chunkIndex) => total + Math.min(chunkSize, file.size! - chunkIndex * chunkSize),
                0,
            );

            uppy.setFileMeta(fileID, { attachmentId });
            uppy.emit('upload-progress', uppy.getFile(fileID), {
                uploadStarted: Date.now(),
                bytesUploaded: uploadedBeforeStart,
                bytesTotal: file.size,
            });

            let completedBytes = uploadedBeforeStart;

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                if (uploadedChunks.has(chunkIndex)) continue;

                const start = chunkIndex * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunk = file.data.slice(start, end);

                await axios.put(`/presentations/${presentationId}/uploads/${attachmentId}/chunks/${chunkIndex}`, chunk, {
                    signal: controller.signal,
                    headers: { 'Content-Type': 'application/octet-stream' },
                    onUploadProgress: (progress) => {
                        uppy.emit('upload-progress', uppy.getFile(fileID), {
                            uploadStarted: Date.now(),
                            bytesUploaded: Math.min(file.size!, completedBytes + progress.loaded),
                            bytesTotal: file.size,
                        });
                    },
                });

                completedBytes += chunk.size;
                uppy.emit('upload-progress', uppy.getFile(fileID), {
                    uploadStarted: Date.now(),
                    bytesUploaded: completedBytes,
                    bytesTotal: file.size,
                });
            }

            const { data: completion } = await axios.post(
                `/presentations/${presentationId}/uploads/${attachmentId}/complete`,
                {},
                { signal: controller.signal },
            );
            const currentFile = uppy.getFile(fileID);

            if (currentFile) {
                uppy.emit('upload-success', currentFile, {
                    status: 200,
                    body: completion,
                    bytesUploaded: file.size,
                    uploadURL: completion.location,
                });
            }
        } catch (error) {
            const currentFile = uppy.getFile(fileID);

            if (currentFile && !axios.isCancel(error)) {
                const uploadError = new Error(errorMessage(error));
                uppy.emit('upload-error', currentFile, uploadError);
            }
        } finally {
            controllers.delete(fileID);
        }
    };

    const uploadFiles = async (fileIDs: string[]) => {
        const queue = [...fileIDs];
        const workerCount = Math.min(limits.parallel_uploads, queue.length);
        const workers = Array.from({ length: workerCount }, async () => {
            let fileID = queue.shift();

            while (fileID) {
                await uploadFile(fileID);
                fileID = queue.shift();
            }
        });

        await Promise.all(workers);
    };

    uppy.addUploader(uploadFiles);
    uppy.on('file-removed', (file) => {
        controllers.get(file.id)?.abort();

        if (!file.progress.uploadComplete && file.meta.attachmentId) {
            void axios.delete(`/presentations/${presentationId}/uploads/${file.meta.attachmentId}`);
        }
    });

    return uppy;
};

const attachmentIcon = (attachment: PresentationAttachmentRecord) => {
    if (attachment.media_type === 'image') return ImageIcon;
    if (attachment.media_type === 'video') return Film;
    if (attachment.media_type === 'archive') return FileArchive;
    if (attachment.media_type === 'link') return Link2;
    return FileText;
};

const attachmentTypeLabel = (attachment: PresentationAttachmentRecord) =>
    ({
        image: 'Фото',
        video: 'Видео',
        document: 'Документ',
        archive: 'Архив',
        link: 'Ссылка',
    })[attachment.media_type];

export default function PresentationShow({
    presentation,
    canManage,
    limits,
}: {
    presentation: PresentationRecord;
    canManage: boolean;
    limits: PresentationLimits;
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Презентации', href: '/presentations' },
        { title: presentation.title, href: `/presentations/${presentation.id}` },
    ];
    const [uppy] = useState(() => createUploader(presentation.id, limits));
    const [attachments, setAttachments] = useState(presentation.attachments);
    const [uploadError, setUploadError] = useState('');
    const [linkOpen, setLinkOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [preview, setPreview] = useState<PresentationAttachmentRecord | null>(null);
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [linkForm, setLinkForm] = useState({ display_name: '', url: '' });
    const [editForm, setEditForm] = useState({
        title: presentation.title,
        description: presentation.description ?? '',
    });

    const activeAttachments = attachments.filter((attachment) => attachment.status !== 'failed');
    const totalSize = activeAttachments.reduce((total, attachment) => total + attachment.size, 0);
    const remainingSlots = Math.max(0, limits.max_attachments - activeAttachments.length);
    const remainingSize = Math.max(0, limits.max_total_size - totalSize);

    useEffect(() => {
        setAttachments(presentation.attachments);
        setEditForm({
            title: presentation.title,
            description: presentation.description ?? '',
        });
    }, [presentation]);

    useEffect(() => {
        uppy.setOptions({
            restrictions: {
                maxFileSize: Math.min(limits.max_file_size, remainingSize || limits.max_file_size),
                maxTotalFileSize: remainingSize,
                maxNumberOfFiles: remainingSlots,
                allowedFileTypes: limits.allowed_extensions.map((extension) => `.${extension}`),
            },
        });
    }, [limits, remainingSize, remainingSlots, uppy]);

    useEffect(() => {
        const onComplete = (result: { failed?: Array<unknown> }) => {
            if ((result.failed ?? []).length === 0) {
                setUploadError('');
                uppy.clear();
            }
            router.reload({ only: ['presentation'] });
        };

        uppy.on('complete', onComplete);
        return () => {
            uppy.off('complete', onComplete);
        };
    }, [presentation.id, uppy]);

    useEffect(() => () => uppy.destroy(), [uppy]);

    const sortedAttachments = useMemo(() => [...attachments].sort((left, right) => left.sort_order - right.sort_order), [attachments]);

    const saveLink = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post(`/presentations/${presentation.id}/attachments/links`, linkForm, {
            preserveScroll: true,
            only: ['presentation'],
            onSuccess: () => {
                setLinkOpen(false);
                setLinkForm({ display_name: '', url: '' });
            },
            onError: (responseErrors) => setErrors(responseErrors as FormErrors),
            onFinish: () => setProcessing(false),
        });
    };

    const savePresentation = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.put(`/presentations/${presentation.id}`, editForm, {
            preserveScroll: true,
            only: ['presentation'],
            onSuccess: () => setEditOpen(false),
            onError: (responseErrors) => setErrors(responseErrors as FormErrors),
            onFinish: () => setProcessing(false),
        });
    };

    const removeAttachment = (attachment: PresentationAttachmentRecord) => {
        if (!window.confirm(`Удалить материал «${attachment.display_name}»?`)) return;
        router.delete(`/presentations/${presentation.id}/attachments/${attachment.id}`, {
            preserveScroll: true,
            only: ['presentation'],
        });
    };

    const removePresentation = () => {
        if (!window.confirm(`Удалить презентацию «${presentation.title}» и все материалы?`)) return;
        router.delete(`/presentations/${presentation.id}`);
    };

    const reorder = async (event: DragEvent<HTMLDivElement>, targetId: number) => {
        event.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        const current = [...sortedAttachments];
        const fromIndex = current.findIndex((attachment) => attachment.id === draggedId);
        const toIndex = current.findIndex((attachment) => attachment.id === targetId);
        const [moved] = current.splice(fromIndex, 1);
        current.splice(toIndex, 0, moved);
        const reordered = current.map((attachment, index) => ({ ...attachment, sort_order: index }));
        setAttachments(reordered);
        setDraggedId(null);

        try {
            await axios.patch(`/presentations/${presentation.id}/attachments/order`, {
                attachment_ids: reordered.map((attachment) => attachment.id),
            });
        } catch (error) {
            setUploadError(errorMessage(error));
            setAttachments(presentation.attachments);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={presentation.title} />
            <CrmPageShell>
                <div>
                    <Button asChild variant="ghost" className="mb-3 -ml-3 text-slate-500">
                        <Link href="/presentations">
                            <ArrowLeft className="size-4" />
                            Все презентации
                        </Link>
                    </Button>
                    <CrmPageHeader
                        title={presentation.title}
                        description={presentation.description ?? 'Материалы презентации'}
                        icon={FolderOpen}
                        eyebrow={`ASTER · LIBRARY · ${activeAttachments.length}/${limits.max_attachments}`}
                        actions={
                            canManage ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" onClick={() => setEditOpen(true)}>
                                        <Pencil className="size-4" />
                                        Изменить
                                    </Button>
                                    <Button variant="outline" className="text-rose-600" onClick={removePresentation}>
                                        <Trash2 className="size-4" />
                                        Удалить
                                    </Button>
                                </div>
                            ) : undefined
                        }
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <CrmSurface className="p-4">
                        <div className="text-xs text-slate-500">Материалов</div>
                        <div className="mt-1 text-2xl font-semibold">{activeAttachments.length}</div>
                    </CrmSurface>
                    <CrmSurface className="p-4">
                        <div className="text-xs text-slate-500">Общий объём</div>
                        <div className="mt-1 text-2xl font-semibold">{formatSize(totalSize)}</div>
                    </CrmSurface>
                    <CrmSurface className="p-4">
                        <div className="text-xs text-slate-500">Осталось</div>
                        <div className="mt-1 text-2xl font-semibold">{remainingSlots} мест</div>
                        <div className="text-xs text-slate-400">{formatSize(remainingSize)}</div>
                    </CrmSurface>
                </div>

                {canManage && remainingSlots > 0 && (
                    <CrmSurface className="overflow-hidden p-0">
                        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/8">
                            <div>
                                <h2 className="font-semibold text-slate-900 dark:text-white">Добавить файлы</h2>
                                <p className="text-xs text-slate-500">
                                    До {formatSize(limits.max_file_size)} на файл, материалы сохраняются на сервере
                                </p>
                            </div>
                            <Button variant="outline" onClick={() => setLinkOpen(true)}>
                                <Link2 className="size-4" />
                                Добавить ссылку
                            </Button>
                        </div>
                        <div className="p-4">
                            {remainingSize > 0 ? (
                                <Dashboard
                                    uppy={uppy}
                                    height={360}
                                    width="100%"
                                    proudlyDisplayPoweredByUppy={false}
                                    hideProgressDetails={false}
                                    hidePauseResumeButton
                                    note={`Можно добавить ещё ${remainingSlots} материалов · доступно ${formatSize(remainingSize)}`}
                                    theme="auto"
                                />
                            ) : (
                                <p className="py-8 text-center text-sm text-slate-500">Лимит файлов исчерпан, но можно добавить внешнюю ссылку.</p>
                            )}
                            {uploadError && <p className="mt-3 text-sm text-rose-600">{uploadError}</p>}
                        </div>
                    </CrmSurface>
                )}

                {sortedAttachments.length === 0 ? (
                    <EmptyState title="Материалов пока нет">
                        {canManage ? 'Добавьте файлы или внешнюю ссылку.' : 'Материалы ещё не добавлены.'}
                    </EmptyState>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {sortedAttachments.map((attachment) => {
                            const Icon = attachmentIcon(attachment);
                            const canPreview =
                                attachment.status === 'ready' &&
                                (attachment.media_type === 'image' ||
                                    attachment.media_type === 'video' ||
                                    attachment.mime_type === 'application/pdf');

                            return (
                                <div
                                    key={attachment.id}
                                    draggable={canManage}
                                    onDragStart={() => setDraggedId(attachment.id)}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => reorder(event, attachment.id)}
                                >
                                    <CrmSurface className="group flex min-h-60 flex-col overflow-hidden">
                                        <div className="relative flex h-32 items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50 dark:border-white/8 dark:bg-white/[0.03]">
                                            {attachment.media_type === 'image' && attachment.view_url ? (
                                                <button type="button" className="h-full w-full" onClick={() => setPreview(attachment)}>
                                                    <img
                                                        src={attachment.view_url}
                                                        alt={attachment.display_name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </button>
                                            ) : attachment.media_type === 'video' && attachment.view_url ? (
                                                <button
                                                    type="button"
                                                    className="flex h-full w-full items-center justify-center bg-slate-900 text-white"
                                                    onClick={() => setPreview(attachment)}
                                                >
                                                    <Play className="size-10 fill-current" />
                                                </button>
                                            ) : (
                                                <Icon className="size-12 text-blue-600 dark:text-blue-300" />
                                            )}
                                            {canManage && (
                                                <GripVertical className="absolute top-2 left-2 size-5 cursor-grab text-slate-400 opacity-0 transition group-hover:opacity-100" />
                                            )}
                                            <Badge className="absolute top-2 right-2 bg-white/90 text-slate-700">
                                                {attachment.status === 'uploading'
                                                    ? 'Загрузка'
                                                    : attachment.status === 'failed'
                                                      ? 'Ошибка'
                                                      : attachmentTypeLabel(attachment)}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-1 flex-col p-4">
                                            <h3 className="line-clamp-2 text-sm font-semibold">{attachment.display_name}</h3>
                                            <div className="mt-1 text-xs text-slate-400">
                                                {attachment.kind === 'file' ? formatSize(attachment.size) : 'Внешняя ссылка'}
                                            </div>
                                            <div className="mt-auto flex items-center gap-1 pt-4">
                                                {attachment.kind === 'link' ? (
                                                    <Button asChild size="sm" variant="ghost" className="flex-1 justify-start">
                                                        <a href={attachment.url ?? '#'} target="_blank" rel="noreferrer">
                                                            <ExternalLink className="size-4" />
                                                            Открыть
                                                        </a>
                                                    </Button>
                                                ) : attachment.status === 'ready' ? (
                                                    <>
                                                        {canPreview && (
                                                            <Button size="sm" variant="ghost" onClick={() => setPreview(attachment)}>
                                                                <Play className="size-4" />
                                                                Просмотр
                                                            </Button>
                                                        )}
                                                        <Button asChild size="sm" variant="ghost" className="ml-auto">
                                                            <a href={attachment.download_url ?? '#'}>
                                                                <Download className="size-4" />
                                                                Скачать
                                                            </a>
                                                        </Button>
                                                    </>
                                                ) : null}
                                                {canManage && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="ml-auto size-8 text-slate-400 hover:text-rose-600"
                                                        onClick={() => removeAttachment(attachment)}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CrmSurface>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CrmPageShell>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Изменить презентацию</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={savePresentation} className="grid gap-4">
                        <CrmFormSection title="Описание">
                            <FormField label="Название" required error={errors.title}>
                                <Input value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
                            </FormField>
                            <FormField label="Описание" error={errors.description}>
                                <Textarea
                                    value={editForm.description}
                                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                                />
                            </FormField>
                        </CrmFormSection>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing}>
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Добавить внешнюю ссылку</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveLink} className="grid gap-4">
                        <FormField label="Название" required error={errors.display_name}>
                            <Input
                                value={linkForm.display_name}
                                onChange={(event) => setLinkForm({ ...linkForm, display_name: event.target.value })}
                                placeholder="Например, видео на YouTube"
                            />
                        </FormField>
                        <FormField label="Ссылка" required error={errors.url}>
                            <Input
                                type="url"
                                value={linkForm.url}
                                onChange={(event) => setLinkForm({ ...linkForm, url: event.target.value })}
                                placeholder="https://..."
                            />
                        </FormField>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing}>
                                <Plus className="size-4" />
                                Добавить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
                <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{preview?.display_name}</DialogTitle>
                    </DialogHeader>
                    {preview?.media_type === 'image' && preview.view_url && (
                        <img src={preview.view_url} alt={preview.display_name} className="max-h-[75vh] w-full object-contain" />
                    )}
                    {preview?.media_type === 'video' && preview.view_url && (
                        <div className="space-y-3">
                            <video src={preview.view_url} controls preload="metadata" className="max-h-[72vh] w-full bg-black" />
                            <p className="text-xs text-slate-500">Если браузер не воспроизводит этот формат, скачайте файл.</p>
                        </div>
                    )}
                    {preview?.mime_type === 'application/pdf' && preview.view_url && (
                        <iframe src={preview.view_url} title={preview.display_name} className="h-[72vh] w-full rounded-md border" />
                    )}
                    <DialogFooter>
                        {preview?.download_url && (
                            <Button asChild>
                                <a href={preview.download_url}>
                                    <Download className="size-4" />
                                    Скачать
                                </a>
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
