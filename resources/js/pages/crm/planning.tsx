import { CrmPageHeader, EmptyState, FormField } from '@/components/crm/crm-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { CalendarClock, MessageSquare, Pencil, Plus, Search, Trash2, User } from 'lucide-react';
import { DragEvent, FormEvent, useMemo, useState } from 'react';
import { FormErrors, PlanningProject, Priority, TaskRecord, TaskStatus, UserSummary } from './types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Планирование', href: '/planning' }];

const columns: { value: TaskStatus; label: string; accent: string }[] = [
    { value: 'planned', label: 'Запланировано', accent: 'border-t-slate-400' },
    { value: 'in_progress', label: 'В работе', accent: 'border-t-blue-500' },
    { value: 'review', label: 'На проверке', accent: 'border-t-amber-500' },
    { value: 'done', label: 'Готово', accent: 'border-t-emerald-500' },
];

const priorityLabels: Record<Priority, string> = {
    low: 'Низкий',
    normal: 'Обычный',
    high: 'Высокий',
};

const makeEmptyForm = (projectId = '') => ({
    project_id: projectId,
    title: '',
    description: '',
    status: 'planned' as TaskStatus,
    priority: 'normal' as Priority,
    assignee_id: '',
    due_date: '',
});

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
                (!needle || `${task.title} ${task.description ?? ''} ${task.project.name} ${task.assignee.name}`.toLowerCase().includes(needle)) &&
                (division === 'all' || task.project.division === division) &&
                (projectFilter === 'all' || task.project_id === Number(projectFilter)) &&
                (assigneeFilter === 'all' || task.assignee_id === Number(assigneeFilter))
            );
        });
    }, [tasks, query, division, projectFilter, assigneeFilter]);

    const selectedProject = projects.find((project) => project.id === Number(form.project_id));

    const openCreate = () => {
        const project = manageableProjects[0];
        setEditing(null);
        setForm({
            ...makeEmptyForm(String(project?.id ?? '')),
            assignee_id: String(project?.participants[0]?.id ?? ''),
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
            status: task.status,
            priority: task.priority,
            assignee_id: String(task.assignee_id),
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

    const changeStatus = (task: TaskRecord, status: TaskStatus) => {
        if (!task.can_change_status || task.status === status) return;
        router.patch(`/tasks/${task.id}/status`, { status }, { preserveScroll: true });
    };

    const onDrop = (event: DragEvent, status: TaskStatus) => {
        event.preventDefault();
        const task = tasks.find((item) => item.id === Number(event.dataTransfer.getData('text/task-id')));
        if (task) changeStatus(task, status);
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

    const isOverdue = (task: TaskRecord) => Boolean(task.due_date && task.status !== 'done' && new Date(`${task.due_date}T23:59:59`) < new Date());

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Планирование" />
            <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
                <CrmPageHeader
                    title="Планирование"
                    description="Задачи проектов JVM, PTL и WAP"
                    actions={
                        manageableProjects.length ? (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" />
                                Новая задача
                            </Button>
                        ) : undefined
                    }
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск задачи..." className="pl-9" />
                    </div>
                    <select
                        value={division}
                        onChange={(event) => setDivision(event.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                        <option value="all">Все направления</option>
                        <option value="jvm">JVM</option>
                        <option value="ptl">PTL</option>
                        <option value="wap">WAP</option>
                    </select>
                    <select
                        value={projectFilter}
                        onChange={(event) => setProjectFilter(event.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                        <option value="all">Все исполнители</option>
                        {assignees.map((assignee) => (
                            <option key={assignee.id} value={assignee.id}>
                                {assignee.name}
                            </option>
                        ))}
                    </select>
                </div>

                {projects.length === 0 ? (
                    <EmptyState>Вам пока не назначены проекты и задачи.</EmptyState>
                ) : (
                    <div className="grid min-w-0 gap-4 xl:grid-cols-4">
                        {columns.map((column) => {
                            const columnTasks = filteredTasks.filter((task) => task.status === column.value);
                            return (
                                <section
                                    key={column.value}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => onDrop(event, column.value)}
                                    className={`bg-muted/30 min-h-64 rounded-xl border border-t-4 ${column.accent}`}
                                >
                                    <div className="flex items-center justify-between p-3">
                                        <h2 className="text-sm font-semibold">{column.label}</h2>
                                        <Badge variant="secondary">{columnTasks.length}</Badge>
                                    </div>
                                    <div className="grid gap-3 p-3 pt-0">
                                        {columnTasks.map((task) => (
                                            <article
                                                key={task.id}
                                                draggable={task.can_change_status}
                                                onDragStart={(event) => event.dataTransfer.setData('text/task-id', String(task.id))}
                                                onClick={() => openDetails(task)}
                                                className="bg-card cursor-pointer rounded-lg border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                            >
                                                <div className="mb-2 flex items-start justify-between gap-2">
                                                    <h3 className="text-sm leading-snug font-medium">{task.title}</h3>
                                                    <Badge variant={task.priority === 'high' ? 'destructive' : 'outline'} className="shrink-0">
                                                        {priorityLabels[task.priority]}
                                                    </Badge>
                                                </div>
                                                <p className="text-muted-foreground mb-3 text-xs">
                                                    {task.project.division.toUpperCase()} · {task.project.name}
                                                </p>
                                                <div className="space-y-1.5 text-xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <User className="text-muted-foreground size-3.5" />
                                                        {task.assignee.name}
                                                    </div>
                                                    <div
                                                        className={`flex items-center gap-1.5 ${isOverdue(task) ? 'text-destructive font-medium' : ''}`}
                                                    >
                                                        <CalendarClock className="size-3.5" />
                                                        {task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : 'Без срока'}
                                                    </div>
                                                    {task.comments.length > 0 && (
                                                        <div className="text-muted-foreground flex items-center gap-1.5">
                                                            <MessageSquare className="size-3.5" />
                                                            {task.comments.length}
                                                        </div>
                                                    )}
                                                </div>
                                                {task.can_change_status && (
                                                    <select
                                                        value={task.status}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onChange={(event) => {
                                                            event.stopPropagation();
                                                            changeStatus(task, event.target.value as TaskStatus);
                                                        }}
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
                                            <div className="text-muted-foreground rounded-lg border border-dashed p-5 text-center text-xs">
                                                Нет задач
                                            </div>
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4">
                        <FormField label="Проект" required error={errors.project_id}>
                            <select
                                value={form.project_id}
                                onChange={(event) => {
                                    const project = projects.find((item) => item.id === Number(event.target.value));
                                    setForm({
                                        ...form,
                                        project_id: event.target.value,
                                        assignee_id: String(project?.participants[0]?.id ?? ''),
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
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField label="Исполнитель" required error={errors.assignee_id}>
                                <select
                                    value={form.assignee_id}
                                    onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}
                                    className="border-input bg-background h-9 rounded-md border px-3"
                                >
                                    <option value="">Выберите исполнителя</option>
                                    {selectedProject?.participants.map((participant) => (
                                        <option key={participant.id} value={participant.id}>
                                            {participant.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Срок" error={errors.due_date}>
                                <Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
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
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    {selectedTask && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{selectedTask.title}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4">
                                <div className="flex flex-wrap gap-2">
                                    <Badge>{columns.find((column) => column.value === selectedTask.status)?.label}</Badge>
                                    <Badge variant={selectedTask.priority === 'high' ? 'destructive' : 'outline'}>
                                        {priorityLabels[selectedTask.priority]}
                                    </Badge>
                                    <Badge variant="secondary">
                                        {selectedTask.project.division.toUpperCase()} · {selectedTask.project.name}
                                    </Badge>
                                </div>
                                {selectedTask.description && (
                                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">{selectedTask.description}</p>
                                )}
                                <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
                                    <div>Исполнитель: {selectedTask.assignee.name}</div>
                                    <div>
                                        Срок: {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('ru-RU') : 'не указан'}
                                    </div>
                                </div>

                                <section>
                                    <h3 className="mb-3 font-medium">Комментарии</h3>
                                    <div className="grid max-h-52 gap-2 overflow-y-auto">
                                        {selectedTask.comments.length === 0 ? (
                                            <p className="text-muted-foreground text-sm">Комментариев пока нет.</p>
                                        ) : (
                                            selectedTask.comments.map((item) => (
                                                <div key={item.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                                                    <div className="mb-1 flex justify-between gap-3 text-xs">
                                                        <span className="font-medium">{item.user?.name ?? 'Пользователь'}</span>
                                                        <span className="text-muted-foreground">
                                                            {new Date(item.created_at).toLocaleString('ru-RU')}
                                                        </span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap">{item.body}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>
                                {selectedTask.can_comment && (
                                    <form onSubmit={submitComment} className="flex gap-2">
                                        <Input
                                            value={comment}
                                            onChange={(event) => setComment(event.target.value)}
                                            placeholder="Добавить комментарий..."
                                        />
                                        <Button type="submit" disabled={!comment.trim()}>
                                            Отправить
                                        </Button>
                                    </form>
                                )}
                            </div>
                            {selectedTask.can_manage && (
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => openEdit(selectedTask)}>
                                        <Pencil className="size-4" />
                                        Изменить
                                    </Button>
                                    <Button variant="destructive" onClick={() => remove(selectedTask)}>
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
