import { AssigneePicker } from '@/components/crm/assignee-picker';
import {
    CrmAvatar,
    CrmAvatarStack,
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
import {
    AlertTriangle,
    CalendarClock,
    CircleDot,
    Clock3,
    GripVertical,
    KanbanSquare,
    List,
    ListTodo,
    MessageSquare,
    Pencil,
    Plus,
    Search,
    Send,
    Trash2,
} from 'lucide-react';
import { DragEvent, FormEvent, useMemo, useState } from 'react';
import { DivisionTaskRecord, FormErrors, PlanningProject, Priority, TaskStatus, UserSummary } from './types';

const columns: {
    value: TaskStatus;
    label: string;
    dot: string;
    surface: string;
}[] = [
    {
        value: 'planned',
        label: 'Запланировано',
        dot: 'bg-slate-400',
        surface: 'border-slate-200/80 bg-slate-100/65 dark:border-white/8 dark:bg-white/[0.025]',
    },
    {
        value: 'in_progress',
        label: 'В работе',
        dot: 'bg-blue-500',
        surface: 'border-blue-200/70 bg-blue-50/65 dark:border-blue-500/12 dark:bg-blue-500/[0.035]',
    },
    {
        value: 'review',
        label: 'На проверке',
        dot: 'bg-amber-500',
        surface: 'border-amber-200/70 bg-amber-50/65 dark:border-amber-500/12 dark:bg-amber-500/[0.035]',
    },
    {
        value: 'done',
        label: 'Готово',
        dot: 'bg-emerald-500',
        surface: 'border-emerald-200/70 bg-emerald-50/65 dark:border-emerald-500/12 dark:bg-emerald-500/[0.035]',
    },
];

const priorityLabels: Record<Priority, string> = {
    low: 'Низкий',
    normal: 'Обычный',
    high: 'Высокий',
};

const priorityClasses: Record<Priority, string> = {
    low: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
    normal: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200',
    high: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200',
};

const priorityStripes: Record<Priority, string> = {
    low: 'bg-slate-300 dark:bg-slate-600',
    normal: 'bg-blue-500',
    high: 'bg-rose-500',
};

const makeEmptyForm = (division: string, assigneeIds: number[] = []) => ({
    division,
    project_id: '',
    title: '',
    description: '',
    status: 'planned' as TaskStatus,
    priority: 'normal' as Priority,
    assignee_ids: assigneeIds,
    due_date: '',
});

const taskIsOverdue = (task: DivisionTaskRecord) =>
    Boolean(task.due_date && task.status !== 'done' && new Date(`${task.due_date}T23:59:59`) < new Date());

const formatDate = (date: string | null) => (date ? new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU') : 'Не указан');

const taskAssignees = (task: DivisionTaskRecord) => (task.assignees.length ? task.assignees : [task.assignee]);

const assigneeSummary = (task: DivisionTaskRecord) => {
    const assigned = taskAssignees(task);
    return assigned.length > 1 ? `${assigned[0].name} +${assigned.length - 1}` : assigned[0].name;
};

export default function DivisionTasks({
    division,
    divisionLabel,
    projects,
    tasks,
    assignees,
    canCreate,
}: {
    division: 'jvm' | 'ptl' | 'wap';
    divisionLabel: string;
    projects: PlanningProject[];
    tasks: DivisionTaskRecord[];
    assignees: UserSummary[];
    canCreate: boolean;
}) {
    const breadcrumbs: BreadcrumbItem[] = [{ title: `Задачи ${divisionLabel}`, href: `/tasks/${division}` }];
    const [view, setView] = useState<'list' | 'kanban'>('list');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [assigneeFilter, setAssigneeFilter] = useState('all');
    const [projectFilter, setProjectFilter] = useState('all');
    const [formOpen, setFormOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [editing, setEditing] = useState<DivisionTaskRecord | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
    const [form, setForm] = useState(makeEmptyForm(division, assignees[0] ? [assignees[0].id] : []));
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);
    const [comment, setComment] = useState('');

    const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
    const selectedProject = projects.find((project) => project.id === Number(form.project_id));
    const formAssignees = selectedProject ? selectedProject.participants : assignees;

    const projectOptions = useMemo(() => {
        const options = new Map<number, string>();
        projects.forEach((project) => options.set(project.id, project.name));
        tasks.forEach((task) => {
            if (task.project) options.set(task.project.id, task.project.name);
        });
        return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [projects, tasks]);

    const filteredTasks = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return tasks.filter((task) => {
            const assigned = taskAssignees(task);
            const haystack =
                `${task.title} ${task.description ?? ''} ${task.project?.name ?? ''} ${assigned.map((item) => item.name).join(' ')}`.toLowerCase();
            return (
                (!needle || haystack.includes(needle)) &&
                (statusFilter === 'all' || task.status === statusFilter) &&
                (priorityFilter === 'all' || task.priority === priorityFilter) &&
                (assigneeFilter === 'all' || assigned.some((item) => item.id === Number(assigneeFilter))) &&
                (projectFilter === 'all' || (projectFilter === 'none' ? task.project_id === null : task.project_id === Number(projectFilter)))
            );
        });
    }, [tasks, query, statusFilter, priorityFilter, assigneeFilter, projectFilter]);

    const visibleAssignees = useMemo(() => {
        const users = new Map<number, UserSummary>();
        assignees.forEach((assignee) => users.set(assignee.id, assignee));
        tasks.forEach((task) => taskAssignees(task).forEach((assignee) => users.set(assignee.id, assignee)));
        return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [assignees, tasks]);

    const plannedCount = tasks.filter((task) => task.status === 'planned').length;
    const activeCount = tasks.filter((task) => ['in_progress', 'review'].includes(task.status)).length;
    const overdueCount = tasks.filter(taskIsOverdue).length;

    const openCreate = () => {
        setEditing(null);
        setForm(makeEmptyForm(division, assignees[0] ? [assignees[0].id] : []));
        setErrors({});
        setFormOpen(true);
    };

    const openEdit = (task: DivisionTaskRecord) => {
        setDetailOpen(false);
        setEditing(task);
        setForm({
            division,
            project_id: String(task.project_id ?? ''),
            title: task.title,
            description: task.description ?? '',
            status: task.status,
            priority: task.priority,
            assignee_ids: taskAssignees(task).map((assignee) => assignee.id),
            due_date: task.due_date ?? '',
        });
        setErrors({});
        setFormOpen(true);
    };

    const openDetails = (task: DivisionTaskRecord) => {
        setSelectedTaskId(task.id);
        setComment('');
        setDetailOpen(true);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        const payload = { ...form, project_id: form.project_id || null };
        const options = {
            preserveScroll: true,
            onSuccess: () => setFormOpen(false),
            onError: (responseErrors: FormErrors) => setErrors(responseErrors),
            onFinish: () => setProcessing(false),
        };

        if (editing) {
            router.put(`/tasks/${editing.id}`, payload, options);
        } else {
            router.post('/tasks', payload, options);
        }
    };

    const changeStatus = (task: DivisionTaskRecord, status: TaskStatus) => {
        if (!task.can_change_status || task.status === status) return;
        router.patch(`/tasks/${task.id}/status`, { status }, { preserveScroll: true });
    };

    const onDrop = (event: DragEvent, status: TaskStatus) => {
        event.preventDefault();
        const task = tasks.find((item) => item.id === Number(event.dataTransfer.getData('text/task-id')));
        setDraggedTaskId(null);
        setDragOverStatus(null);
        if (task) changeStatus(task, status);
    };

    const remove = (task: DivisionTaskRecord) => {
        if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
        setDetailOpen(false);
        router.delete(`/tasks/${task.id}`, { preserveScroll: true });
    };

    const submitComment = (event: FormEvent) => {
        event.preventDefault();
        if (!selectedTask || !comment.trim()) return;
        router.post(`/tasks/${selectedTask.id}/comments`, { body: comment }, { preserveScroll: true, onSuccess: () => setComment('') });
    };

    const statusBadge = (task: DivisionTaskRecord) => (
        <Badge variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            {columns.find((column) => column.value === task.status)?.label}
        </Badge>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Задачи ${divisionLabel}`} />
            <CrmPageShell>
                <CrmPageHeader
                    title={`Задачи ${divisionLabel}`}
                    description={`Рабочие задачи направления ${divisionLabel}: ответственные, сроки и статусы`}
                    icon={ListTodo}
                    eyebrow={`ASTER · ${divisionLabel} TASKS`}
                    actions={
                        canCreate ? (
                            <Button onClick={openCreate} className="bg-white text-[#123864] shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                                <Plus className="size-4" />
                                Новая задача
                            </Button>
                        ) : undefined
                    }
                />

                <CrmStatsGrid>
                    <CrmStatCard label="Все задачи" value={tasks.length} hint={`Направление ${divisionLabel}`} icon={ListTodo} tone="blue" />
                    <CrmStatCard label="Запланировано" value={plannedCount} hint="Ожидают начала" icon={CircleDot} tone="violet" />
                    <CrmStatCard label="В процессе" value={activeCount} hint="Работа и проверка" icon={Clock3} tone="cyan" />
                    <CrmStatCard label="Просрочено" value={overdueCount} hint="Требуют внимания" icon={AlertTriangle} tone="rose" />
                </CrmStatsGrid>

                <CrmToolbar>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(13rem,1fr)_9.5rem_9.5rem_11rem_11rem_auto] 2xl:items-center">
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
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm"
                        >
                            <option value="all">Все статусы</option>
                            {columns.map((column) => (
                                <option key={column.value} value={column.value}>
                                    {column.label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={priorityFilter}
                            onChange={(event) => setPriorityFilter(event.target.value)}
                            className="border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm"
                        >
                            <option value="all">Все приоритеты</option>
                            {Object.entries(priorityLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={assigneeFilter}
                            onChange={(event) => setAssigneeFilter(event.target.value)}
                            className="border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm"
                        >
                            <option value="all">Все исполнители</option>
                            {visibleAssignees.map((assignee) => (
                                <option key={assignee.id} value={assignee.id}>
                                    {assignee.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={projectFilter}
                            onChange={(event) => setProjectFilter(event.target.value)}
                            className="border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm"
                        >
                            <option value="all">Все проекты</option>
                            <option value="none">Без проекта</option>
                            {projectOptions.map(([id, name]) => (
                                <option key={id} value={id}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <div className="flex min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:col-span-2 xl:col-span-1 dark:border-white/10 dark:bg-white/5">
                            <Button
                                type="button"
                                size="sm"
                                variant={view === 'list' ? 'default' : 'ghost'}
                                onClick={() => setView('list')}
                                className="h-7 min-w-0 flex-1 px-2.5"
                            >
                                <List className="size-3.5" />
                                Список
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={view === 'kanban' ? 'default' : 'ghost'}
                                onClick={() => setView('kanban')}
                                className="h-7 min-w-0 flex-1 px-2.5"
                            >
                                <KanbanSquare className="size-3.5" />
                                Канбан
                            </Button>
                        </div>
                    </div>
                </CrmToolbar>

                {filteredTasks.length === 0 ? (
                    <EmptyState title="Задачи не найдены">Создайте первую задачу или измените выбранные фильтры.</EmptyState>
                ) : view === 'list' ? (
                    <CrmSurface>
                        <div className="divide-y divide-slate-100 xl:hidden dark:divide-white/6">
                            {filteredTasks.map((task) => (
                                <article
                                    key={task.id}
                                    onClick={() => openDetails(task)}
                                    className="cursor-pointer p-4 transition hover:bg-blue-50/50 sm:p-5 dark:hover:bg-blue-500/[0.035]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-slate-900 dark:text-white">{task.title}</h3>
                                            {task.description && (
                                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{task.description}</p>
                                            )}
                                        </div>
                                        <Badge variant="outline" className={`shrink-0 ${priorityClasses[task.priority]}`}>
                                            {priorityLabels[task.priority]}
                                        </Badge>
                                    </div>
                                    <div className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-300">
                                        {task.project?.name ?? 'Без проекта'}
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <CrmAvatarStack names={taskAssignees(task).map((assignee) => assignee.name)} />
                                            <span className="truncate text-sm text-slate-700 dark:text-slate-200">{assigneeSummary(task)}</span>
                                        </div>
                                        <span
                                            className={`flex items-center gap-1.5 text-xs ${
                                                taskIsOverdue(task)
                                                    ? 'font-semibold text-rose-600 dark:text-rose-300'
                                                    : 'text-slate-500 dark:text-slate-400'
                                            }`}
                                        >
                                            <CalendarClock className="size-3.5" />
                                            {formatDate(task.due_date)}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                            <MessageSquare className="size-3.5" />
                                            {task.comments.length}
                                        </span>
                                    </div>
                                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/6">
                                        {task.can_change_status ? (
                                            <select
                                                value={task.status}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => changeStatus(task, event.target.value as TaskStatus)}
                                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm sm:w-auto"
                                            >
                                                {columns.map((column) => (
                                                    <option key={column.value} value={column.value}>
                                                        {column.label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            statusBadge(task)
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto xl:block">
                            <table className="w-full min-w-[920px] text-left text-sm">
                                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:border-white/8 dark:bg-white/[0.025]">
                                    <tr>
                                        <th className="px-5 py-3">Задача</th>
                                        <th className="px-4 py-3">Проект</th>
                                        <th className="px-4 py-3">Исполнители</th>
                                        <th className="px-4 py-3">Статус</th>
                                        <th className="px-4 py-3">Приоритет</th>
                                        <th className="px-4 py-3">Срок</th>
                                        <th className="px-4 py-3 text-center">Комментарии</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/6">
                                    {filteredTasks.map((task) => (
                                        <tr
                                            key={task.id}
                                            onClick={() => openDetails(task)}
                                            className="cursor-pointer transition hover:bg-blue-50/50 dark:hover:bg-blue-500/[0.035]"
                                        >
                                            <td className="max-w-sm px-5 py-4">
                                                <div className="font-semibold text-slate-900 dark:text-white">{task.title}</div>
                                                {task.description && (
                                                    <div className="mt-1 line-clamp-1 text-xs text-slate-500">{task.description}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{task.project?.name ?? 'Без проекта'}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <CrmAvatarStack names={taskAssignees(task).map((assignee) => assignee.name)} />
                                                    <span className="max-w-36 truncate text-slate-700 dark:text-slate-200">
                                                        {assigneeSummary(task)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {task.can_change_status ? (
                                                    <select
                                                        value={task.status}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onChange={(event) => changeStatus(task, event.target.value as TaskStatus)}
                                                        className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                                                    >
                                                        {columns.map((column) => (
                                                            <option key={column.value} value={column.value}>
                                                                {column.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    statusBadge(task)
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <Badge variant="outline" className={priorityClasses[task.priority]}>
                                                    {priorityLabels[task.priority]}
                                                </Badge>
                                            </td>
                                            <td
                                                className={`px-4 py-4 whitespace-nowrap ${
                                                    taskIsOverdue(task)
                                                        ? 'font-semibold text-rose-600 dark:text-rose-300'
                                                        : 'text-slate-600 dark:text-slate-300'
                                                }`}
                                            >
                                                {formatDate(task.due_date)}
                                            </td>
                                            <td className="px-4 py-4 text-center text-slate-500">
                                                <span className="inline-flex items-center gap-1">
                                                    <MessageSquare className="size-3.5" />
                                                    {task.comments.length}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CrmSurface>
                ) : (
                    <div className="crm-scrollbar min-w-0 overflow-x-auto pb-3">
                        <div className="grid min-w-[1120px] grid-cols-4 gap-4">
                            {columns.map((column) => {
                                const columnTasks = filteredTasks.filter((task) => task.status === column.value);
                                const isDragTarget = dragOverStatus === column.value;
                                return (
                                    <section
                                        key={column.value}
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            setDragOverStatus(column.value);
                                        }}
                                        onDragLeave={() => setDragOverStatus(null)}
                                        onDrop={(event) => onDrop(event, column.value)}
                                        className={`min-h-[27rem] rounded-2xl border p-3 transition-all ${column.surface} ${isDragTarget ? 'border-blue-400 ring-4 ring-blue-400/10' : ''}`}
                                    >
                                        <div className="mb-3 flex items-center justify-between px-1 py-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`size-2 rounded-full ${column.dot}`} />
                                                <h2 className="text-sm font-semibold">{column.label}</h2>
                                            </div>
                                            <span className="rounded-lg bg-white/80 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-900/70 dark:text-slate-300">
                                                {columnTasks.length}
                                            </span>
                                        </div>
                                        <div className="grid gap-3">
                                            {columnTasks.map((task) => (
                                                <article
                                                    key={task.id}
                                                    draggable={task.can_change_status}
                                                    onDragStart={(event) => {
                                                        event.dataTransfer.setData('text/task-id', String(task.id));
                                                        setDraggedTaskId(task.id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggedTaskId(null);
                                                        setDragOverStatus(null);
                                                    }}
                                                    onClick={() => openDetails(task)}
                                                    className={`crm-card-hover group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 dark:border-white/8 dark:bg-slate-900/90 ${draggedTaskId === task.id ? 'opacity-45' : ''}`}
                                                >
                                                    <span className={`absolute inset-y-0 left-0 w-1 ${priorityStripes[task.priority]}`} />
                                                    <div className="flex items-start gap-2 pl-1">
                                                        {task.can_change_status && <GripVertical className="mt-0.5 size-4 text-slate-300" />}
                                                        <h3 className="flex-1 text-sm leading-snug font-semibold text-slate-900 dark:text-white">
                                                            {task.title}
                                                        </h3>
                                                    </div>
                                                    <p className="mt-2 pl-1 text-[11px] font-medium tracking-wide text-blue-600 uppercase dark:text-blue-300">
                                                        {task.project?.name ?? 'Без проекта'}
                                                    </p>
                                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/6">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <CrmAvatarStack names={taskAssignees(task).map((assignee) => assignee.name)} />
                                                            <span className="truncate text-xs">{assigneeSummary(task)}</span>
                                                        </div>
                                                        <span
                                                            className={`flex items-center gap-1 text-[11px] ${taskIsOverdue(task) ? 'font-semibold text-rose-600' : 'text-slate-400'}`}
                                                        >
                                                            <CalendarClock className="size-3.5" />
                                                            {task.due_date ? formatDate(task.due_date) : '—'}
                                                        </span>
                                                    </div>
                                                    {task.can_change_status && (
                                                        <select
                                                            value={task.status}
                                                            onClick={(event) => event.stopPropagation()}
                                                            onChange={(event) => changeStatus(task, event.target.value as TaskStatus)}
                                                            className="border-input bg-background mt-3 h-8 w-full rounded-md border px-2 text-xs xl:hidden"
                                                        >
                                                            {columns.map((item) => (
                                                                <option key={item.value} value={item.value}>
                                                                    {item.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </article>
                                            ))}
                                            {columnTasks.length === 0 && (
                                                <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300/80 p-5 text-xs text-slate-400 dark:border-white/10">
                                                    {isDragTarget ? 'Переместить сюда' : 'Нет задач'}
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
                                ASTER · {divisionLabel} TASK
                            </div>
                            <DialogTitle>{editing ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle>
                        </div>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4 px-6 pb-6">
                        <CrmFormSection title="Задача" description="Название, ожидаемый результат и необязательный проект">
                            <FormField label="Проект" error={errors.project_id}>
                                <select
                                    value={form.project_id}
                                    onChange={(event) => {
                                        const project = projects.find((item) => item.id === Number(event.target.value));
                                        const available = project?.participants ?? assignees;
                                        const availableIds = new Set(available.map((item) => item.id));
                                        const selectedIds = form.assignee_ids.filter((id) => availableIds.has(id));
                                        setForm({
                                            ...form,
                                            project_id: event.target.value,
                                            assignee_ids: selectedIds.length ? selectedIds : available[0] ? [available[0].id] : [],
                                        });
                                    }}
                                    className="border-input bg-background h-9 rounded-md border px-3"
                                >
                                    <option value="">Без проекта</option>
                                    {projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
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

                        <CrmFormSection title="Исполнение" description="Исполнители, срок, статус и приоритет">
                            <FormField label="Исполнители" required error={errors.assignee_ids || errors['assignee_ids.0']}>
                                <AssigneePicker
                                    options={formAssignees}
                                    selectedIds={form.assignee_ids}
                                    onChange={(assigneeIds) => setForm({ ...form, assignee_ids: assigneeIds })}
                                />
                            </FormField>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <FormField label="Срок" error={errors.due_date}>
                                    <Input
                                        type="date"
                                        value={form.due_date}
                                        onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                                    />
                                </FormField>
                                <FormField label="Статус" required error={errors.status}>
                                    <select
                                        value={form.status}
                                        onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}
                                        className="border-input bg-background h-9 rounded-md border px-3"
                                    >
                                        {columns.map((column) => (
                                            <option key={column.value} value={column.value}>
                                                {column.label}
                                            </option>
                                        ))}
                                    </select>
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
                        <DialogFooter className="border-t border-slate-100 pt-4 dark:border-white/8">
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
                                <div className="border-b border-slate-100 bg-blue-50/70 px-6 py-5 dark:border-white/8 dark:bg-blue-500/[0.06]">
                                    <div className="mb-2 flex flex-wrap gap-2">
                                        {statusBadge(selectedTask)}
                                        <Badge variant="outline" className={priorityClasses[selectedTask.priority]}>
                                            {priorityLabels[selectedTask.priority]}
                                        </Badge>
                                        <Badge variant="outline">
                                            {divisionLabel} · {selectedTask.project?.name ?? 'Без проекта'}
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
                                            <div className="font-medium">
                                                {taskAssignees(selectedTask)
                                                    .map((assignee) => assignee.name)
                                                    .join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CalendarClock className="size-5 text-blue-700" />
                                        <div>
                                            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Срок</div>
                                            <div className={taskIsOverdue(selectedTask) ? 'font-semibold text-rose-600' : 'font-medium'}>
                                                {formatDate(selectedTask.due_date)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <section>
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="font-semibold">Комментарии</h3>
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
                                                            <span className="font-medium">{item.user?.name ?? 'Пользователь'}</span>
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
                                        />
                                        <Button type="submit" size="icon" disabled={!comment.trim()} className="shrink-0 bg-[#123864] text-white">
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
                                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
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
