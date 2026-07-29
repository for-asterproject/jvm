import { AssigneePicker } from '@/components/crm/assignee-picker';
import {
    CrmAvatar,
    CrmAvatarStack,
    CrmFormSection,
    CrmPageHeader,
    CrmPageShell,
    CrmStatCard,
    CrmStatsGrid,
    CrmToolbar,
    EmptyState,
    FormField,
} from '@/components/crm/crm-ui';
import { TaskProgress, TaskWorkflowPanel } from '@/components/crm/task-workflow-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, CalendarClock, CircleDot, Clock3, KanbanSquare, MessageSquare, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { FormErrors, PlanningProject, Priority, TaskRecord, TaskStatus, UserSummary } from './types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Планирование', href: '/planning' }];

const columns: {
    value: TaskStatus;
    label: string;
    dot: string;
    header: string;
    surface: string;
}[] = [
    {
        value: 'planned',
        label: 'Ожидает',
        dot: 'bg-slate-400',
        header: 'text-slate-700 dark:text-slate-200',
        surface: 'border-slate-200/80 bg-slate-100/65 dark:border-white/8 dark:bg-white/[0.025]',
    },
    {
        value: 'in_progress',
        label: 'В работе',
        dot: 'bg-blue-500',
        header: 'text-blue-800 dark:text-blue-200',
        surface: 'border-blue-200/70 bg-blue-50/65 dark:border-blue-500/12 dark:bg-blue-500/[0.035]',
    },
    {
        value: 'review',
        label: 'На проверке',
        dot: 'bg-amber-500',
        header: 'text-amber-800 dark:text-amber-200',
        surface: 'border-amber-200/70 bg-amber-50/65 dark:border-amber-500/12 dark:bg-amber-500/[0.035]',
    },
    {
        value: 'needs_revision',
        label: 'На доработке',
        dot: 'bg-orange-500',
        header: 'text-orange-800 dark:text-orange-200',
        surface: 'border-orange-200/70 bg-orange-50/65 dark:border-orange-500/12 dark:bg-orange-500/[0.035]',
    },
    {
        value: 'done',
        label: 'Завершено',
        dot: 'bg-emerald-500',
        header: 'text-emerald-800 dark:text-emerald-200',
        surface: 'border-emerald-200/70 bg-emerald-50/65 dark:border-emerald-500/12 dark:bg-emerald-500/[0.035]',
    },
];

const priorityLabels: Record<Priority, string> = {
    low: 'Низкий',
    normal: 'Обычный',
    high: 'Высокий',
};

const priorityStripes: Record<Priority, string> = {
    low: 'bg-slate-300 dark:bg-slate-600',
    normal: 'bg-blue-500',
    high: 'bg-rose-500',
};

const makeEmptyForm = (projectId = '') => ({
    project_id: projectId,
    title: '',
    description: '',
    priority: 'normal' as Priority,
    assignee_ids: [] as number[],
    due_date: '',
});

const taskIsOverdue = (task: TaskRecord) => Boolean(task.due_date && task.status !== 'done' && new Date(`${task.due_date}T23:59:59`) < new Date());

const taskAssignees = (task: TaskRecord) => (task.assignees.length ? task.assignees : [task.assignee]);

const assigneeSummary = (task: TaskRecord) => {
    const assigned = taskAssignees(task);
    return assigned.length > 1 ? `${assigned[0].name} +${assigned.length - 1}` : assigned[0].name;
};

export default function Planning({ projects, tasks }: { projects: PlanningProject[]; tasks: TaskRecord[] }) {
    const manageableProjects = projects.filter((project) => project.can_manage);
    const [query, setQuery] = useState('');
    const [division, setDivision] = useState('all');
    const [projectFilter, setProjectFilter] = useState('all');
    const [assigneeFilter, setAssigneeFilter] = useState('all');
    const [formOpen, setFormOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [editing, setEditing] = useState<TaskRecord | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [form, setForm] = useState(makeEmptyForm(String(manageableProjects[0]?.id ?? '')));
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);
    const [comment, setComment] = useState('');

    const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

    const assignees = useMemo(() => {
        const users = new Map<number, UserSummary>();
        projects.forEach((project) => project.participants.forEach((user) => users.set(user.id, user)));
        return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [projects]);

    const filteredTasks = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return tasks.filter((task) => {
            return (
                (!needle ||
                    `${task.title} ${task.description ?? ''} ${task.project.name} ${taskAssignees(task)
                        .map((assignee) => assignee.name)
                        .join(' ')}`
                        .toLowerCase()
                        .includes(needle)) &&
                (division === 'all' || task.project.division === division) &&
                (projectFilter === 'all' || task.project_id === Number(projectFilter)) &&
                (assigneeFilter === 'all' || taskAssignees(task).some((assignee) => assignee.id === Number(assigneeFilter)))
            );
        });
    }, [tasks, query, division, projectFilter, assigneeFilter]);

    const selectedProject = projects.find((project) => project.id === Number(form.project_id));
    const plannedCount = tasks.filter((task) => task.status === 'planned').length;
    const activeCount = tasks.filter((task) => ['in_progress', 'review', 'needs_revision'].includes(task.status)).length;
    const overdueCount = tasks.filter(taskIsOverdue).length;

    const openCreate = () => {
        const project = manageableProjects[0];
        setEditing(null);
        setForm({
            ...makeEmptyForm(String(project?.id ?? '')),
            assignee_ids: project?.participants[0] ? [project.participants[0].id] : [],
        });
        setErrors({});
        setFormOpen(true);
    };

    const openEdit = (task: TaskRecord) => {
        setDetailOpen(false);
        setEditing(task);
        setForm({
            project_id: String(task.project_id),
            title: task.title,
            description: task.description ?? '',
            priority: task.priority,
            assignee_ids: taskAssignees(task).map((assignee) => assignee.id),
            due_date: task.due_date ?? '',
        });
        setErrors({});
        setFormOpen(true);
    };

    const openDetails = (task: TaskRecord) => {
        setSelectedTaskId(task.id);
        setComment('');
        setDetailOpen(true);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        const options = {
            preserveScroll: true,
            onSuccess: () => setFormOpen(false),
            onError: (responseErrors: FormErrors) => setErrors(responseErrors),
            onFinish: () => setProcessing(false),
        };

        if (editing) {
            router.put(`/tasks/${editing.id}`, form, options);
        } else {
            router.post('/tasks', form, options);
        }
    };

    const remove = (task: TaskRecord) => {
        if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
        setDetailOpen(false);
        router.delete(`/tasks/${task.id}`, { preserveScroll: true });
    };

    const submitComment = (event: FormEvent) => {
        event.preventDefault();
        if (!selectedTask || !comment.trim()) return;
        router.post(
            `/tasks/${selectedTask.id}/comments`,
            { body: comment },
            {
                preserveScroll: true,
                onSuccess: () => setComment(''),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Планирование" />
            <CrmPageShell>
                <CrmPageHeader
                    title="Планирование"
                    description="Единый рабочий ритм проектов JVM, PTL и WAP"
                    icon={KanbanSquare}
                    eyebrow="ASTER · PLANNING"
                    actions={
                        manageableProjects.length ? (
                            <Button onClick={openCreate} className="bg-white text-[#123864] shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                                <Plus className="size-4" />
                                Новая задача
                            </Button>
                        ) : undefined
                    }
                />

                <CrmStatsGrid>
                    <CrmStatCard label="Все задачи" value={tasks.length} hint="В доступных проектах" icon={KanbanSquare} tone="blue" />
                    <CrmStatCard label="Запланировано" value={plannedCount} hint="Ожидают начала" icon={CircleDot} tone="violet" />
                    <CrmStatCard label="В процессе" value={activeCount} hint="Работа и проверка" icon={Clock3} tone="cyan" />
                    <CrmStatCard label="Просрочено" value={overdueCount} hint="Требуют внимания" icon={AlertTriangle} tone="rose" />
                </CrmStatsGrid>

                <CrmToolbar>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="relative">
                            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Поиск задачи..."
                                className="border-slate-200 bg-slate-50/80 pl-9 shadow-none focus-visible:bg-white dark:border-white/10 dark:bg-white/5"
                            />
                        </div>
                        <select
                            value={division}
                            onChange={(event) => setDivision(event.target.value)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Все направления</option>
                            <option value="jvm">JVM</option>
                            <option value="ptl">PTL</option>
                            <option value="wap">WAP</option>
                        </select>
                        <select
                            value={projectFilter}
                            onChange={(event) => setProjectFilter(event.target.value)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Все проекты</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={assigneeFilter}
                            onChange={(event) => setAssigneeFilter(event.target.value)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Все исполнители</option>
                            {assignees.map((assignee) => (
                                <option key={assignee.id} value={assignee.id}>
                                    {assignee.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </CrmToolbar>

                {projects.length === 0 ? (
                    <EmptyState title="Нет доступных проектов">После назначения проекта здесь появятся задачи и канбан.</EmptyState>
                ) : (
                    <div className="crm-scrollbar w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-3">
                        <div className="grid min-w-[1400px] grid-cols-5 items-start gap-4">
                            {columns.map((column) => {
                                const columnTasks = filteredTasks.filter((task) => task.status === column.value);

                                return (
                                    <section
                                        key={column.value}
                                        className={`min-h-[27rem] min-w-0 rounded-2xl border p-3 transition-all ${column.surface}`}
                                    >
                                        <div className="mb-3 flex items-center justify-between px-1 py-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`size-2 rounded-full ${column.dot}`} />
                                                <h2 className={`text-sm font-semibold ${column.header}`}>{column.label}</h2>
                                            </div>
                                            <span className="flex min-w-7 items-center justify-center rounded-lg bg-white/80 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-white/8">
                                                {columnTasks.length}
                                            </span>
                                        </div>

                                        <div className="grid gap-3">
                                            {columnTasks.map((task) => (
                                                <article
                                                    key={task.id}
                                                    onClick={() => openDetails(task)}
                                                    className="crm-card-hover group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_-24px_rgba(15,45,82,0.9)] dark:border-white/8 dark:bg-slate-900/90"
                                                >
                                                    <span className={`absolute inset-y-0 left-0 w-1 ${priorityStripes[task.priority]}`} />
                                                    <div className="mb-2 flex items-start gap-2 pl-1">
                                                        <h3 className="flex-1 text-sm leading-snug font-semibold text-slate-900 dark:text-white">
                                                            {task.title}
                                                        </h3>
                                                        {task.priority === 'high' && (
                                                            <Badge
                                                                variant="outline"
                                                                className="shrink-0 border-rose-200 bg-rose-50 text-[10px] text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                                                            >
                                                                Высокий
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="mb-4 pl-1 text-[11px] font-medium tracking-wide text-blue-600 uppercase dark:text-blue-300">
                                                        {task.project.division} · {task.project.name}
                                                    </p>
                                                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/6">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <CrmAvatarStack names={taskAssignees(task).map((assignee) => assignee.name)} />
                                                            <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                                                                {assigneeSummary(task)}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={`flex shrink-0 items-center gap-1 text-[11px] ${
                                                                taskIsOverdue(task)
                                                                    ? 'font-semibold text-rose-600 dark:text-rose-300'
                                                                    : 'text-slate-400'
                                                            }`}
                                                        >
                                                            <CalendarClock className="size-3.5" />
                                                            {task.due_date
                                                                ? new Date(task.due_date).toLocaleDateString('ru-RU', {
                                                                      day: '2-digit',
                                                                      month: '2-digit',
                                                                  })
                                                                : '—'}
                                                        </div>
                                                    </div>
                                                    {task.comments.length > 0 && (
                                                        <div className="mt-2 flex justify-end text-[11px] text-slate-400">
                                                            <span className="flex items-center gap-1">
                                                                <MessageSquare className="size-3.5" />
                                                                {task.comments.length}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="mt-3">
                                                        <TaskProgress task={task} />
                                                    </div>
                                                </article>
                                            ))}
                                            {columnTasks.length === 0 && (
                                                <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300/80 p-5 text-center text-xs text-slate-400 transition dark:border-white/10">
                                                    Нет задач
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CrmPageShell>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="crm-scrollbar max-h-[90vh] overflow-y-auto border-slate-200/70 bg-white/95 p-0 sm:max-w-2xl dark:border-white/10 dark:bg-slate-950/95">
                    <DialogHeader>
                        <div className="border-b border-slate-100 px-6 py-5 dark:border-white/8">
                            <div className="mb-1 text-[10px] font-semibold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-300">
                                ASTER · TASK
                            </div>
                            <DialogTitle>{editing ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle>
                        </div>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4 px-6 pb-6">
                        <CrmFormSection title="Задача" description="Проект, название и ожидаемый результат">
                            <FormField label="Проект" required error={errors.project_id}>
                                <select
                                    value={form.project_id}
                                    onChange={(event) => {
                                        const project = projects.find((item) => item.id === Number(event.target.value));
                                        const participants = project?.participants ?? [];
                                        const participantIds = new Set(participants.map((participant) => participant.id));
                                        const selectedIds = form.assignee_ids.filter((id) => participantIds.has(id));
                                        setForm({
                                            ...form,
                                            project_id: event.target.value,
                                            assignee_ids: selectedIds.length ? selectedIds : participants[0] ? [participants[0].id] : [],
                                        });
                                    }}
                                    className="border-input bg-background h-9 rounded-md border px-3"
                                >
                                    {manageableProjects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.division.toUpperCase()} · {project.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Название" required error={errors.title}>
                                <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                            </FormField>
                            <FormField label="Описание" error={errors.description}>
                                <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                            </FormField>
                        </CrmFormSection>

                        <CrmFormSection title="Исполнение" description="Исполнители, срок и приоритет">
                            <FormField label="Исполнители" required error={errors.assignee_ids || errors['assignee_ids.0']}>
                                <AssigneePicker
                                    options={selectedProject?.participants ?? []}
                                    selectedIds={form.assignee_ids}
                                    onChange={(assigneeIds) => setForm({ ...form, assignee_ids: assigneeIds })}
                                />
                            </FormField>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField label="Срок" error={errors.due_date}>
                                    <Input
                                        type="date"
                                        value={form.due_date}
                                        onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                                    />
                                </FormField>
                                <FormField label="Приоритет" required error={errors.priority}>
                                    <select
                                        value={form.priority}
                                        onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}
                                        className="border-input bg-background h-9 rounded-md border px-3"
                                    >
                                        {Object.entries(priorityLabels).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>
                            </div>
                        </CrmFormSection>

                        <DialogFooter className="mt-1 border-t border-slate-100 pt-4 dark:border-white/8">
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing} className="bg-[#123864] text-white hover:bg-[#0d2d52]">
                                {processing ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="crm-scrollbar max-h-[90vh] overflow-y-auto border-slate-200/70 bg-white/95 p-0 sm:max-w-2xl dark:border-white/10 dark:bg-slate-950/95">
                    {selectedTask && (
                        <>
                            <DialogHeader>
                                <div className="relative overflow-hidden border-b border-slate-100 bg-[linear-gradient(135deg,#eff6ff,#f8fafc)] px-6 py-5 dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.1),rgba(15,23,42,0.4))]">
                                    <div className="mb-2 flex flex-wrap gap-2">
                                        <Badge className="bg-[#123864] text-white">
                                            {columns.find((column) => column.value === selectedTask.status)?.label}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className={
                                                selectedTask.priority === 'high'
                                                    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'
                                                    : 'border-slate-200 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                                            }
                                        >
                                            {priorityLabels[selectedTask.priority]}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className="border-blue-200 bg-white/70 text-blue-700 dark:border-blue-500/20 dark:bg-white/5 dark:text-blue-200"
                                        >
                                            {selectedTask.project.division.toUpperCase()} · {selectedTask.project.name}
                                        </Badge>
                                    </div>
                                    <DialogTitle className="text-xl leading-snug">{selectedTask.title}</DialogTitle>
                                </div>
                            </DialogHeader>

                            <div className="grid gap-5 px-6 pb-6">
                                {selectedTask.description && (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                                        {selectedTask.description}
                                    </p>
                                )}
                                <div className="grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm sm:grid-cols-2 dark:border-white/8 dark:bg-white/[0.025]">
                                    <div className="flex items-center gap-3">
                                        <CrmAvatarStack names={taskAssignees(selectedTask).map((assignee) => assignee.name)} />
                                        <div>
                                            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Исполнители</div>
                                            <div className="font-medium text-slate-800 dark:text-slate-200">
                                                {taskAssignees(selectedTask)
                                                    .map((assignee) => assignee.name)
                                                    .join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                                            <CalendarClock className="size-4" />
                                        </span>
                                        <div>
                                            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Срок</div>
                                            <div
                                                className={
                                                    taskIsOverdue(selectedTask)
                                                        ? 'font-semibold text-rose-600 dark:text-rose-300'
                                                        : 'font-medium text-slate-800 dark:text-slate-200'
                                                }
                                            >
                                                {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('ru-RU') : 'Не указан'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <TaskWorkflowPanel task={selectedTask} />

                                <section>
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="font-semibold text-slate-900 dark:text-white">Комментарии</h3>
                                        <span className="text-xs text-slate-400">{selectedTask.comments.length}</span>
                                    </div>
                                    <div className="crm-scrollbar grid max-h-56 gap-3 overflow-y-auto pr-1">
                                        {selectedTask.comments.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400 dark:border-white/10">
                                                Комментариев пока нет.
                                            </div>
                                        ) : (
                                            selectedTask.comments.map((item) => (
                                                <div key={item.id} className="flex gap-3">
                                                    <CrmAvatar name={item.user?.name ?? 'Пользователь'} className="size-7 rounded-lg" />
                                                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-slate-50 p-3 text-sm dark:bg-white/[0.04]">
                                                        <div className="mb-1 flex justify-between gap-3 text-xs">
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                                {item.user?.name ?? 'Пользователь'}
                                                            </span>
                                                            <span className="text-slate-400">
                                                                {new Date(item.created_at).toLocaleString('ru-RU')}
                                                            </span>
                                                        </div>
                                                        <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{item.body}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>

                                {selectedTask.can_comment && (
                                    <form onSubmit={submitComment} className="flex gap-2 border-t border-slate-100 pt-4 dark:border-white/8">
                                        <Input
                                            value={comment}
                                            onChange={(event) => setComment(event.target.value)}
                                            placeholder="Добавить комментарий..."
                                            className="bg-slate-50 shadow-none dark:bg-white/5"
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            disabled={!comment.trim()}
                                            className="shrink-0 bg-[#123864] text-white hover:bg-[#0d2d52]"
                                        >
                                            <Send className="size-4" />
                                        </Button>
                                    </form>
                                )}
                            </div>

                            {selectedTask.can_manage && (
                                <DialogFooter className="border-t border-slate-100 px-6 py-4 dark:border-white/8">
                                    <Button variant="outline" onClick={() => openEdit(selectedTask)}>
                                        <Pencil className="size-4" />
                                        Изменить
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                                        onClick={() => remove(selectedTask)}
                                    >
                                        <Trash2 className="size-4" />
                                        Удалить
                                    </Button>
                                </DialogFooter>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
