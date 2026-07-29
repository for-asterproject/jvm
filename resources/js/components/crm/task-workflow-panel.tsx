import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TaskAssignmentRecord, TaskRecord, TaskReportLimits, TaskReportRecord, TaskStatus } from '@/pages/crm/types';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { Check, Download, FileText, LoaderCircle, Paperclip, Play, RotateCcw, Send } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { CrmAvatar } from './crm-ui';

const statusLabels: Record<TaskStatus, string> = {
    planned: 'Ожидает',
    in_progress: 'В работе',
    review: 'На проверке',
    needs_revision: 'На доработке',
    done: 'Завершено',
};

const statusClasses: Record<TaskStatus, string> = {
    planned: 'border-slate-200 bg-slate-50 text-slate-600',
    in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
    review: 'border-violet-200 bg-violet-50 text-violet-700',
    needs_revision: 'border-orange-200 bg-orange-50 text-orange-700',
    done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const reportStatusLabels = {
    pending: 'Ожидает проверки',
    accepted: 'Принят',
    revision_requested: 'Возвращён на доработку',
};

const errorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
        const errors = error.response?.data?.errors as Record<string, string[] | string> | undefined;
        const first = errors ? Object.values(errors)[0] : null;
        if (Array.isArray(first)) return first[0];
        if (typeof first === 'string') return first;
        if (typeof error.response?.data?.message === 'string') return error.response.data.message;
    }

    return 'Не удалось выполнить действие. Попробуйте ещё раз.';
};

const formatSize = (size: number) => {
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} КБ`;
    return `${(size / 1024 / 1024).toFixed(1)} МБ`;
};

type TaskWorkflowTask = Pick<TaskRecord, 'id' | 'status' | 'assignments' | 'assignments_count' | 'accepted_reports_count'>;

export function TaskProgress({ task }: { task: TaskWorkflowTask }) {
    if (task.assignments_count <= 1) {
        const status = task.assignments[0]?.status ?? task.status;
        return (
            <Badge variant="outline" className={statusClasses[status]}>
                {statusLabels[status]}
            </Badge>
        );
    }

    return (
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Принято {task.accepted_reports_count}/{task.assignments_count}
        </Badge>
    );
}

type WorkflowDetails = {
    id: number;
    status: TaskStatus;
    can_review_reports: boolean;
    assignments: TaskAssignmentRecord[];
};

export function TaskWorkflowPanel({ task }: { task: TaskWorkflowTask }) {
    const [details, setDetails] = useState<WorkflowDetails | null>(null);
    const [limits, setLimits] = useState<TaskReportLimits | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [progress, setProgress] = useState(0);
    const [revisionReportId, setRevisionReportId] = useState<number | null>(null);
    const [revisionComment, setRevisionComment] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const { data } = await axios.get(`/tasks/${task.id}/workflow`);
            setDetails(data.task);
            setLimits(data.limits);
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // The workflow endpoint is the source of truth when another task is opened.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task.id]);

    const currentAssignment = useMemo(() => details?.assignments.find((assignment) => assignment.is_current_user) ?? null, [details]);

    const refresh = async () => {
        await load();
        router.reload({ only: ['tasks'] });
    };

    const start = async () => {
        setProcessing(true);
        setError('');

        try {
            await axios.post(`/tasks/${task.id}/start`);
            await refresh();
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setProcessing(false);
        }
    };

    const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(event.target.files ?? []);

        if (!limits) return;
        if (selected.length > limits.max_attachments) {
            setError(`Можно приложить не больше ${limits.max_attachments} файлов.`);
            return;
        }

        const invalid = selected.find((file) => {
            const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
            return file.size > limits.max_file_size || !limits.allowed_extensions.includes(extension);
        });

        if (invalid) {
            setError(`Файл «${invalid.name}» превышает 20 МБ или имеет неподдерживаемый формат.`);
            return;
        }

        setError('');
        setFiles(selected);
    };

    const uploadFile = async (file: File, fileIndex: number): Promise<number> => {
        const { data } = await axios.post(`/tasks/${task.id}/report-uploads`, {
            name: file.name,
            size: file.size,
            mime_type: file.type,
            last_modified: file.lastModified,
        });
        const attachmentId = Number(data.attachment_id);
        const chunkSize = Number(data.chunk_size);
        const totalChunks = Number(data.total_chunks);

        if (!data.upload_complete) {
            const uploadedChunks = new Set<number>((data.uploaded_chunks as number[]).map(Number));

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                if (uploadedChunks.has(chunkIndex)) continue;
                const start = chunkIndex * chunkSize;
                const chunk = file.slice(start, Math.min(start + chunkSize, file.size));

                await axios.put(`/tasks/${task.id}/report-uploads/${attachmentId}/chunks/${chunkIndex}`, chunk, {
                    headers: { 'Content-Type': 'application/octet-stream' },
                    onUploadProgress: (upload) => {
                        const filePart = (chunkIndex + upload.loaded / chunk.size) / totalChunks;
                        setProgress(Math.round(((fileIndex + filePart) / Math.max(files.length, 1)) * 100));
                    },
                });
            }

            await axios.post(`/tasks/${task.id}/report-uploads/${attachmentId}/complete`);
        }

        return attachmentId;
    };

    const submitReport = async () => {
        if (!body.trim()) {
            setError('Напишите, что было выполнено.');
            return;
        }

        setProcessing(true);
        setProgress(0);
        setError('');

        try {
            const attachmentIds: number[] = [];
            for (let index = 0; index < files.length; index++) {
                attachmentIds.push(await uploadFile(files[index], index));
            }
            await axios.post(`/tasks/${task.id}/reports`, {
                body: body.trim(),
                attachment_ids: attachmentIds,
            });
            setBody('');
            setFiles([]);
            setProgress(100);
            await refresh();
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setProcessing(false);
        }
    };

    const accept = async (report: TaskReportRecord) => {
        setProcessing(true);
        setError('');

        try {
            await axios.patch(`/tasks/${task.id}/reports/${report.id}/accept`);
            await refresh();
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setProcessing(false);
        }
    };

    const revision = async (report: TaskReportRecord) => {
        if (!revisionComment.trim()) {
            setError('Укажите, что нужно доработать.');
            return;
        }

        setProcessing(true);
        setError('');

        try {
            await axios.patch(`/tasks/${task.id}/reports/${report.id}/revision`, {
                comment: revisionComment.trim(),
            });
            setRevisionComment('');
            setRevisionReportId(null);
            await refresh();
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 py-8 text-sm text-slate-500">
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Загрузка работы по задаче…
            </div>
        );
    }

    return (
        <section className="grid gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">Исполнение и отчёты</h3>
                    <p className="mt-1 text-xs text-slate-500">Каждый исполнитель сдаёт и защищает свой результат отдельно.</p>
                </div>
                <TaskProgress task={{ ...task, status: details?.status ?? task.status }} />
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

            {currentAssignment?.can_start && (
                <Button type="button" onClick={start} disabled={processing} className="w-full bg-blue-700 text-white hover:bg-blue-800">
                    <Play className="size-4" />
                    Взять задачу в работу
                </Button>
            )}

            {currentAssignment?.can_submit_report && (
                <div className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                    <div>
                        <div className="text-sm font-semibold">
                            {currentAssignment.status === 'needs_revision' ? 'Отправить доработку' : 'Сдать отчёт'}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Текст обязателен. Файлы можно не прикладывать.</p>
                    </div>
                    <Textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        rows={5}
                        maxLength={10000}
                        placeholder="Опишите выполненную работу и полученный результат…"
                    />
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-white px-4 py-3 text-sm text-blue-700 hover:bg-blue-50">
                        <Paperclip className="size-4" />
                        {files.length ? `Выбрано файлов: ${files.length}` : 'Добавить до 3 файлов по 20 МБ'}
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            accept={limits?.allowed_extensions.map((extension) => `.${extension}`).join(',')}
                            onChange={chooseFiles}
                        />
                    </label>
                    {files.length > 0 && (
                        <div className="grid gap-1 text-xs text-slate-600">
                            {files.map((file) => (
                                <div key={`${file.name}-${file.lastModified}`} className="flex justify-between gap-3">
                                    <span className="truncate">{file.name}</span>
                                    <span>{formatSize(file.size)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {processing && progress > 0 && (
                        <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    )}
                    <Button
                        type="button"
                        onClick={submitReport}
                        disabled={processing || !body.trim()}
                        className="bg-emerald-700 text-white hover:bg-emerald-800"
                    >
                        {processing ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                        {currentAssignment.status === 'needs_revision' ? 'Отправить доработку' : 'Отправить на проверку'}
                    </Button>
                </div>
            )}

            <div className="grid gap-3">
                {details?.assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.025]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <CrmAvatar name={assignment.user.name} className="size-8 rounded-xl" />
                                <div>
                                    <div className="text-sm font-semibold">{assignment.user.name}</div>
                                    <div className="text-xs text-slate-400">{assignment.user.email}</div>
                                </div>
                            </div>
                            <Badge variant="outline" className={statusClasses[assignment.status]}>
                                {statusLabels[assignment.status]}
                            </Badge>
                        </div>

                        {assignment.reports && assignment.reports.length > 0 && (
                            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
                                {assignment.reports.map((report, reportIndex) => (
                                    <article key={report.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[0.035]">
                                        <div className="flex items-center justify-between gap-3 text-xs">
                                            <span className="font-semibold">Отчёт #{assignment.reports!.length - reportIndex}</span>
                                            <span className="text-slate-400">{new Date(report.created_at).toLocaleString('ru-RU')}</span>
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{report.body}</p>
                                        {report.attachments.length > 0 && (
                                            <div className="mt-3 grid gap-2">
                                                {report.attachments.map((attachment) => (
                                                    <div
                                                        key={attachment.id}
                                                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"
                                                    >
                                                        <FileText className="size-4 text-blue-600" />
                                                        <a
                                                            href={attachment.view_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="min-w-0 flex-1 truncate text-xs text-blue-700 hover:underline"
                                                        >
                                                            {attachment.display_name}
                                                        </a>
                                                        <span className="text-[10px] text-slate-400">{formatSize(attachment.size)}</span>
                                                        <a href={attachment.download_url} title="Скачать">
                                                            <Download className="size-4 text-slate-500" />
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="mt-3 text-xs font-medium text-slate-500">{reportStatusLabels[report.status]}</div>
                                        {report.review_comment && (
                                            <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800">
                                                <span className="font-semibold">Что доработать:</span> {report.review_comment}
                                            </div>
                                        )}
                                        {details.can_review_reports && report.status === 'pending' && (
                                            <div className="mt-3 grid gap-2">
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => accept(report)}
                                                        disabled={processing}
                                                        className="bg-emerald-700 text-white hover:bg-emerald-800"
                                                    >
                                                        <Check className="size-4" />
                                                        Принять
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setRevisionReportId(revisionReportId === report.id ? null : report.id)}
                                                        disabled={processing}
                                                    >
                                                        <RotateCcw className="size-4" />
                                                        На доработку
                                                    </Button>
                                                </div>
                                                {revisionReportId === report.id && (
                                                    <div className="grid gap-2">
                                                        <Textarea
                                                            value={revisionComment}
                                                            onChange={(event) => setRevisionComment(event.target.value)}
                                                            rows={3}
                                                            placeholder="Укажите, что именно нужно исправить…"
                                                        />
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => revision(report)}
                                                            disabled={processing || !revisionComment.trim()}
                                                        >
                                                            Отправить замечание
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
