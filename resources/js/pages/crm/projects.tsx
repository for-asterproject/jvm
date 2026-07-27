import { CrmPageHeader, EmptyState, FormField } from '@/components/crm/crm-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Calendar, CircleDollarSign, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { FormErrors, Priority, ProjectRecord, ProjectStatus, UserSummary } from './types';

const statusLabels: Record<ProjectStatus, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    paused: 'Пауза',
    completed: 'Завершён',
    cancelled: 'Отменён',
};

const priorityLabels: Record<Priority, string> = {
    low: 'Низкий',
    normal: 'Обычный',
    high: 'Высокий',
};

const makeEmptyForm = (managerId = '') => ({
    name: '',
    client_name: '',
    description: '',
    status: 'new' as ProjectStatus,
    priority: 'normal' as Priority,
    manager_id: managerId,
    start_date: '',
    due_date: '',
    budget: '',
    budget_currency: 'KZT' as 'KZT' | 'USD',
    notes: '',
    member_ids: [] as number[],
});

export default function Projects({
    division,
    divisionLabel,
    projects,
    managers,
    availableMembers,
    canCreate,
}: {
    division: 'jvm' | 'ptl' | 'wap';
    divisionLabel: string;
    projects: ProjectRecord[];
    managers: UserSummary[];
    availableMembers: UserSummary[];
    canCreate: boolean;
}) {
    const breadcrumbs: BreadcrumbItem[] = [{ title: `Проекты ${divisionLabel}`, href: `/projects/${division}` }];
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [priority, setPriority] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ProjectRecord | null>(null);
    const [form, setForm] = useState(makeEmptyForm(String(managers[0]?.id ?? '')));
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return projects.filter((project) => {
            const matchesQuery =
                !needle ||
                `${project.name} ${project.client_name ?? ''} ${project.description ?? ''} ${project.manager.name}`.toLowerCase().includes(needle);
            return matchesQuery && (status === 'all' || project.status === status) && (priority === 'all' || project.priority === priority);
        });
    }, [projects, query, status, priority]);

    const openCreate = () => {
        setEditing(null);
        setForm(makeEmptyForm(String(managers[0]?.id ?? '')));
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (project: ProjectRecord) => {
        setEditing(project);
        setForm({
            name: project.name,
            client_name: project.client_name ?? '',
            description: project.description ?? '',
            status: project.status,
            priority: project.priority,
            manager_id: String(project.manager_id),
            start_date: project.start_date ?? '',
            due_date: project.due_date ?? '',
            budget: project.budget ?? '',
            budget_currency: project.budget_currency,
            notes: project.notes ?? '',
            member_ids: project.members.map((member) => member.id),
        });
        setErrors({});
        setDialogOpen(true);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        const options = {
            preserveScroll: true,
            onSuccess: () => setDialogOpen(false),
            onError: (responseErrors: FormErrors) => setErrors(responseErrors),
            onFinish: () => setProcessing(false),
        };

        if (editing) {
            router.put(`/projects/${division}/${editing.id}`, form, options);
        } else {
            router.post(`/projects/${division}`, form, options);
        }
    };

    const remove = (project: ProjectRecord) => {
        if (!window.confirm(`Удалить проект «${project.name}» вместе с его задачами?`)) return;
        router.delete(`/projects/${division}/${project.id}`, { preserveScroll: true });
    };

    const toggleMember = (memberId: number, checked: boolean) => {
        setForm({
            ...form,
            member_ids: checked ? [...form.member_ids, memberId] : form.member_ids.filter((id) => id !== memberId),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Проекты ${divisionLabel}`} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <CrmPageHeader
                    title={`Проекты ${divisionLabel}`}
                    description="Проекты, сроки, бюджет и команда направления"
                    actions={
                        canCreate ? (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" />
                                Новый проект
                            </Button>
                        ) : undefined
                    }
                />

                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="relative sm:col-span-1">
                        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск проекта..." className="pl-9" />
                    </div>
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                        <option value="all">Все статусы</option>
                        {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                        <option value="all">Все приоритеты</option>
                        {Object.entries(priorityLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                {filtered.length === 0 ? (
                    <EmptyState>Проекты не найдены или пока не назначены вам.</EmptyState>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((project) => (
                            <Card key={project.id} className="gap-4">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <CardTitle className="leading-snug">{project.name}</CardTitle>
                                        <Badge
                                            variant={
                                                project.status === 'cancelled'
                                                    ? 'destructive'
                                                    : project.status === 'completed'
                                                      ? 'secondary'
                                                      : 'default'
                                            }
                                        >
                                            {statusLabels[project.status]}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground text-sm">{project.client_name || 'Клиент не указан'}</p>
                                </CardHeader>
                                <CardContent className="flex-1 space-y-3 text-sm">
                                    {project.description && <p className="text-muted-foreground line-clamp-3">{project.description}</p>}
                                    <div className="grid gap-2">
                                        <div className="flex items-center gap-2">
                                            <Users className="text-muted-foreground size-4" />
                                            <span>
                                                {project.manager.name} · {project.members.length} участн.
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="text-muted-foreground size-4" />
                                            <span>
                                                {project.due_date ? `до ${new Date(project.due_date).toLocaleDateString('ru-RU')}` : 'Срок не указан'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CircleDollarSign className="text-muted-foreground size-4" />
                                            <span>
                                                {project.budget
                                                    ? `${Number(project.budget).toLocaleString('ru-RU')} ${project.budget_currency}`
                                                    : 'Бюджет не указан'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-3">
                                        <Badge variant={project.priority === 'high' ? 'destructive' : 'outline'}>
                                            {priorityLabels[project.priority]}
                                        </Badge>
                                        <span className="text-muted-foreground text-xs">Задач: {project.tasks_count}</span>
                                    </div>
                                </CardContent>
                                {project.can_manage && (
                                    <CardFooter className="gap-2">
                                        <Button size="sm" variant="outline" onClick={() => openEdit(project)}>
                                            <Pencil className="size-4" />
                                            Изменить
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => remove(project)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </CardFooter>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Редактировать проект' : `Новый проект ${divisionLabel}`}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField label="Название" required error={errors.name}>
                                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                            </FormField>
                            <FormField label="Клиент" error={errors.client_name}>
                                <Input value={form.client_name} onChange={(event) => setForm({ ...form, client_name: event.target.value })} />
                            </FormField>
                        </div>
                        <FormField label="Описание" error={errors.description}>
                            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                        </FormField>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <FormField label="Статус" required error={errors.status}>
                                <select
                                    value={form.status}
                                    onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })}
                                    className="border-input bg-background h-9 rounded-md border px-3"
                                >
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
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
                            <FormField label="Руководитель" required error={errors.manager_id}>
                                <select
                                    value={form.manager_id}
                                    onChange={(event) => setForm({ ...form, manager_id: event.target.value })}
                                    className="border-input bg-background h-9 rounded-md border px-3"
                                >
                                    {managers.map((manager) => (
                                        <option key={manager.id} value={manager.id}>
                                            {manager.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField label="Дата начала" error={errors.start_date}>
                                <Input
                                    type="date"
                                    value={form.start_date}
                                    onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                                />
                            </FormField>
                            <FormField label="Срок завершения" error={errors.due_date}>
                                <Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
                            </FormField>
                            <FormField label="Бюджет" error={errors.budget}>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.budget}
                                    onChange={(event) => setForm({ ...form, budget: event.target.value })}
                                />
                            </FormField>
                            <FormField label="Валюта" required error={errors.budget_currency}>
                                <select
                                    value={form.budget_currency}
                                    onChange={(event) => setForm({ ...form, budget_currency: event.target.value as 'KZT' | 'USD' })}
                                    className="border-input bg-background h-9 rounded-md border px-3"
                                >
                                    <option value="KZT">KZT</option>
                                    <option value="USD">USD</option>
                                </select>
                            </FormField>
                        </div>
                        <FormField label="Участники" error={errors.member_ids}>
                            <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                                {availableMembers.length === 0 ? (
                                    <span className="text-muted-foreground text-sm">Нет доступных подчинённых или консультантов.</span>
                                ) : (
                                    availableMembers.map((member) => (
                                        <label key={member.id} className="hover:bg-muted flex items-start gap-2 rounded-md p-2">
                                            <Checkbox
                                                checked={form.member_ids.includes(member.id)}
                                                onCheckedChange={(checked) => toggleMember(member.id, checked === true)}
                                            />
                                            <span className="min-w-0 text-sm">
                                                <span className="block truncate font-medium">{member.name}</span>
                                                <span className="text-muted-foreground block truncate text-xs">
                                                    {member.roles?.join(', ') || member.email}
                                                </span>
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </FormField>
                        <FormField label="Заметки" error={errors.notes}>
                            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                        </FormField>
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
