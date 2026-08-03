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
import { TaskProgress, TaskWorkflowPanel } from '@/components/crm/task-workflow-panel';
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
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    MessageSquare,
    Pencil,
    Plus,
    Search,
    Send,
    Trash2,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { DivisionTaskRecord, FormErrors, Priority, TaskStatus, UserSummary } from './types';

type Division = DivisionTaskRecord['division'];
type DivisionFilter = Division | 'all';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Календарь задач', href: '/planning' }];

const statusLabels: Record<TaskStatus, string> = {
    planned: 'Ожидает',
    in_progress: 'В работе',
    review: 'На проверке',
    needs_revision: 'На доработке',
    done: 'Завершено',
};

const priorityLabels: Record<Priority, string> = {
    low: 'Низкий',
    normal: 'Обычный',
    high: 'Высокий',
};

const divisionLabels: Record<Division, string> = {
    jvm: 'JVM',
    ptl: 'PTL',
    wap: 'WAP',
};

const divisionStyles: Record<
    Division,
    {
        chip: string;
        dot: string;
        event: string;
        glow: string;
    }
> = {
    jvm: {
        chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200',
        dot: 'bg-sky-500',
        event: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100',
        glow: 'from-sky-500/14',
    },
    ptl: {
        chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
        dot: 'bg-emerald-500',
        event: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100',
        glow: 'from-emerald-500/14',
    },
    wap: {
        chip: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100',
        dot: 'bg-amber-500',
        event: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100',
        glow: 'from-amber-500/14',
    },
};

const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const makeEmptyForm = (division: Division, dueDate = '') => ({
    division,
    title: '',
    description: '',
    priority: 'normal' as Priority,
    assignee_ids: [] as number[],
    due_date: dueDate,
});

const pad = (value: number) => String(value).padStart(2, '0');

const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateKey = (value: string) => new Date(`${value}T00:00:00`);

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const buildCalendarDays = (monthDate: Date) => {
    const firstDay = startOfMonth(monthDate);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const cursor = new Date(firstDay);
    cursor.setDate(firstDay.getDate() - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
        const day = new Date(cursor);
        day.setDate(cursor.getDate() + index);
        return day;
    });
};

const taskIsOverdue = (task: DivisionTaskRecord) =>
    Boolean(task.due_date && task.status !== 'done' && new Date(`${task.due_date}T23:59:59`) < new Date());

const taskAssignees = (task: DivisionTaskRecord) => (task.assignees.length ? task.assignees : [task.assignee]);

const assigneeSummary = (task: DivisionTaskRecord) => {
    const assigned = taskAssignees(task);
    return assigned.length > 1 ? `${assigned[0].name} +${assigned.length - 1}` : assigned[0].name;
};

const formatDate = (value: string) => parseDateKey(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

const formatMonth = (date: Date) => date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

const taskDivisionLabel = (task: DivisionTaskRecord) => divisionLabels[task.division];

function TaskCalendarCard({
    task,
    compact = false,
    onOpen,
}: {
    task: DivisionTaskRecord;
    compact?: boolean;
    onOpen: (task: DivisionTaskRecord) => void;
}) {
    const style = divisionStyles[task.division];

    return (
        <button
            type="button"
            onClick={() => onOpen(task)}
            className={`group w-full rounded-xl border px-3 py-2 text-left text-xs transition ${style.event}`}
        >
            <div className="flex items-start gap-2">
                <span className={`mt-1 size-2 shrink-0 rounded-full ${style.dot}`} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{task.title}</span>
                        {task.priority === 'high' && <span className="shrink-0 rounded bg-rose-500 px-1 text-[9px] text-white">HIGH</span>}
                    </div>
                    {!compact && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] opacity-80">
                            <span>{taskDivisionLabel(task)}</span>
                            <span>{assigneeSummary(task)}</span>
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
}

export default function Planning({
    tasks,
    assignees,
    canCreate,
}: {
    tasks: DivisionTaskRecord[];
    assignees: UserSummary[];
    canCreate: boolean;
}) {
    const today = dateKey(new Date());
    const [query, setQuery] = useState('');
    const [division, setDivision] = useState<DivisionFilter>('all');
    const [assigneeFilter, setAssigneeFilter] = useState('all');
    const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(today);
    const [formOpen, setFormOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [editing, setEditing] = useState<DivisionTaskRecord | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [form, setForm] = useState(makeEmptyForm('jvm', today));
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);
    const [comment, setComment] = useState('');

    const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

    const filteredTasks = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return tasks.filter((task) => {
            const haystack = `${task.title} ${task.description ?? ''} ${taskDivisionLabel(task)} ${taskAssignees(task)
                .map((assignee) => assignee.name)
                .join(' ')}`.toLowerCase();

            return (
                (!needle || haystack.includes(needle)) &&
                (division === 'all' || task.division === division) &&
                (assigneeFilter === 'all' || taskAssignees(task).some((assignee) => assignee.id === Number(assigneeFilter)))
            );
        });
    }, [tasks, query, division, assigneeFilter]);

    const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
    const scheduledTasks = filteredTasks.filter((task) => task.due_date);
    const unscheduledTasks = filteredTasks.filter((task) => !task.due_date);
    const overdueCount = filteredTasks.filter(taskIsOverdue).length;
    const todayCount = filteredTasks.filter((task) => task.due_date === today).length;
    const activeCount = filteredTasks.filter((task) => ['in_progress', 'review', 'needs_revision'].includes(task.status)).length;

    const tasksByDate = useMemo(() => {
        const grouped = new Map<string, DivisionTaskRecord[]>();
        scheduledTasks.forEach((task) => {
            if (!task.due_date) return;
            grouped.set(task.due_date, [...(grouped.get(task.due_date) ?? []), task]);
        });
        return grouped;
    }, [scheduledTasks]);

    const selectedDayTasks = tasksByDate.get(selectedDate) ?? [];

    const changeMonth = (delta: number) => {
        const nextMonth = startOfMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1));
        setMonthDate(nextMonth);
        setSelectedDate(dateKey(nextMonth));
    };

    const openCreate = (dueDate = selectedDate) => {
        setEditing(null);
        setForm({
            ...makeEmptyForm(division === 'all' ? 'jvm' : division, dueDate),
            assignee_ids: assignees[0] ? [assignees[0].id] : [],
        });
        setErrors({});
        setFormOpen(true);
    };

    const openEdit = (task: DivisionTaskRecord) => {
        setDetailOpen(false);
        setEditing(task);
        setForm({
            division: task.division,
            title: task.title,
            description: task.description ?? '',
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
        const options = {
            preserveScroll: true,
            onSuccess: () => setFormOpen(false),
            onError: (responseErrors: FormErrors) => setErrors(responseErrors),
            onFinish: () => setProcessing(false),
        };

        if (editing) {
            router.put(`/tasks/${editing.id}`, { ...form, project_id: null }, options);
        } else {
            router.post('/tasks', { ...form, project_id: null }, options);
        }
    };

    const remove = (task: DivisionTaskRecord) => {
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
            <Head title="Календарь задач" />
            <CrmPageShell>
                <CrmPageHeader
                    title="Календарь задач"
                    description="Месячный календарь задач JVM, PTL и WAP по срокам выполнения"
                    icon={CalendarDays}
                    eyebrow="ASTER · TASK CALENDAR"
                    actions={
                        canCreate ? (
                            <Button onClick={() => openCreate()} className="bg-white text-[#123864] shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                                <Plus className="size-4" />
                                Новая задача
                            </Button>
                        ) : undefined
                    }
                />

                <CrmStatsGrid>
                    <CrmStatCard label="По фильтрам" value={filteredTasks.length} hint="Задачи направлений" icon={CalendarDays} tone="blue" />
                    <CrmStatCard label="На календаре" value={scheduledTasks.length} hint="Есть срок" icon={CalendarClock} tone="cyan" />
                    <CrmStatCard label="Сегодня" value={todayCount} hint="Срок сегодня" icon={Clock3} tone="amber" />
                    <CrmStatCard label="Просрочено" value={overdueCount} hint={`${activeCount} активных`} icon={AlertTriangle} tone="rose" />
                </CrmStatsGrid>

                <CrmToolbar>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                            onChange={(event) => setDivision(event.target.value as DivisionFilter)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Все направления</option>
                            {Object.entries(divisionLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
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

                {tasks.length === 0 ? (
                    <EmptyState title="Задач пока нет">Создайте первую задачу направления, чтобы она появилась в календаре.</EmptyState>
                ) : (
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
                        <CrmSurface className="overflow-hidden">
                            <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/8">
                                <div>
                                    <div className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">Месяц</div>
                                    <h2 className="text-xl font-semibold text-slate-950 capitalize dark:text-white">{formatMonth(monthDate)}</h2>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {Object.entries(divisionLabels).map(([value, label]) => {
                                        const divisionValue = value as Division;
                                        return (
                                            <Badge key={value} variant="outline" className={divisionStyles[divisionValue].chip}>
                                                <span className={`mr-1.5 size-2 rounded-full ${divisionStyles[divisionValue].dot}`} />
                                                {label}
                                            </Badge>
                                        );
                                    })}
                                    <div className="ml-0 flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5 sm:ml-2">
                                        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => changeMonth(-1)}>
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8"
                                            onClick={() => {
                                                const current = startOfMonth(new Date());
                                                setMonthDate(current);
                                                setSelectedDate(today);
                                            }}
                                        >
                                            Сегодня
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => changeMonth(1)}>
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:border-white/8 dark:bg-white/[0.025]">
                                {weekdayLabels.map((day) => (
                                    <div key={day} className="px-2 py-3">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7">
                                {calendarDays.map((day) => {
                                    const key = dateKey(day);
                                    const dayTasks = tasksByDate.get(key) ?? [];
                                    const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                                    const isSelected = key === selectedDate;
                                    const isToday = key === today;

                                    return (
                                        <div
                                            key={key}
                                            onClick={() => setSelectedDate(key)}
                                            className={`min-h-28 cursor-pointer border-r border-b border-slate-100 p-2 transition last:border-r-0 dark:border-white/6 ${
                                                isSelected
                                                    ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-400/40 dark:bg-blue-500/10'
                                                    : isCurrentMonth
                                                      ? 'bg-white/80 hover:bg-slate-50 dark:bg-slate-950/20 dark:hover:bg-white/[0.035]'
                                                      : 'bg-slate-50/60 text-slate-400 dark:bg-white/[0.015]'
                                            }`}
                                        >
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <span
                                                    className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                                                        isToday
                                                            ? 'bg-[#123864] text-white'
                                                            : isCurrentMonth
                                                              ? 'text-slate-700 dark:text-slate-200'
                                                              : 'text-slate-400'
                                                    }`}
                                                >
                                                    {day.getDate()}
                                                </span>
                                                {dayTasks.length > 0 && (
                                                    <span className="rounded-full bg-slate-900/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                                                        {dayTasks.length}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid gap-1">
                                                {dayTasks.slice(0, 3).map((task) => (
                                                    <TaskCalendarCard key={task.id} task={task} compact onOpen={openDetails} />
                                                ))}
                                                {dayTasks.length > 3 && (
                                                    <div className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-white/8 dark:text-slate-300">
                                                        Еще {dayTasks.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CrmSurface>

                        <div className="grid content-start gap-5">
                            <CrmSurface>
                                <div className="border-b border-slate-100 p-4 dark:border-white/8">
                                    <div className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">Выбранный день</div>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                        <h2 className="font-semibold text-slate-950 dark:text-white">{formatDate(selectedDate)}</h2>
                                        {canCreate && (
                                            <Button type="button" size="sm" variant="outline" onClick={() => openCreate(selectedDate)}>
                                                <Plus className="size-3.5" />
                                                Задача
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="grid gap-3 p-4">
                                    {selectedDayTasks.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400 dark:border-white/10">
                                            На этот день задач нет.
                                        </div>
                                    ) : (
                                        selectedDayTasks.map((task) => (
                                            <article
                                                key={task.id}
                                                onClick={() => openDetails(task)}
                                                className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent p-4 shadow-[0_16px_40px_-34px_rgba(15,45,82,0.9)] transition hover:-translate-y-0.5 ${divisionStyles[task.division].chip} ${divisionStyles[task.division].glow}`}
                                            >
                                                <div className="mb-2 flex items-start justify-between gap-3">
                                                    <h3 className="font-semibold text-slate-950 dark:text-white">{task.title}</h3>
                                                    <Badge variant="outline" className="shrink-0 bg-white/70 text-[10px] dark:bg-white/5">
                                                        {statusLabels[task.status]}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs font-medium tracking-wide uppercase">{taskDivisionLabel(task)}</p>
                                                <div className="mt-3 flex items-center justify-between gap-3 border-t border-current/10 pt-3 text-xs">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <CrmAvatarStack names={taskAssignees(task).map((assignee) => assignee.name)} />
                                                        <span className="truncate">{assigneeSummary(task)}</span>
                                                    </div>
                                                    {task.comments.length > 0 && (
                                                        <span className="flex shrink-0 items-center gap-1 opacity-70">
                                                            <MessageSquare className="size-3.5" />
                                                            {task.comments.length}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-3">
                                                    <TaskProgress task={task} />
                                                </div>
                                            </article>
                                        ))
                                    )}
                                </div>
                            </CrmSurface>

                            <CrmSurface>
                                <div className="border-b border-slate-100 p-4 dark:border-white/8">
                                    <h2 className="font-semibold text-slate-950 dark:text-white">Без срока</h2>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Задачи без даты выполнения не попадают в сетку.</p>
                                </div>
                                <div className="grid max-h-80 gap-2 overflow-y-auto p-4">
                                    {unscheduledTasks.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400 dark:border-white/10">
                                            Нет задач без срока.
                                        </div>
                                    ) : (
                                        unscheduledTasks.map((task) => <TaskCalendarCard key={task.id} task={task} onOpen={openDetails} />)
                                    )}
                                </div>
                            </CrmSurface>
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
                        <CrmFormSection title="Задача" description="Направление, название и ожидаемый результат">
                            <FormField label="Направление" required error={errors.division}>
                                <select
                                    value={form.division}
                                    onChange={(event) => setForm({ ...form, division: event.target.value as Division })}
                                    className="border-input bg-background h-9 rounded-md border px-3"
                                >
                                    {Object.entries(divisionLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
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
                                    options={assignees}
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
                                        <Badge className="bg-[#123864] text-white">{statusLabels[selectedTask.status]}</Badge>
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
                                        <Badge variant="outline" className={divisionStyles[selectedTask.division].chip}>
                                            {taskDivisionLabel(selectedTask)}
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
                                                {selectedTask.due_date ? formatDate(selectedTask.due_date) : 'Не указан'}
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
