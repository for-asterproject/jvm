import {
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
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { BriefcaseBusiness, Calendar, CheckCircle2, CircleDollarSign, Clock3, ListChecks, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { FormErrors, Priority, ProjectRecord, ProjectStatus, UserSummary } from './types';

const statusLabels: Record<ProjectStatus, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    paused: 'Пауза',
    completed: 'Завершён',
    cancelled: 'Отменён',
};

const statusClasses: Record<ProjectStatus, string> = {
    new: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200',
    in_progress: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200',
    paused: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
    cancelled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200',
};

const priorityLabels: Record<Priority, string> = {
    low: 'Низкий',
    normal: 'Обычный',
    high: 'Высокий',
};

const divisionClasses = {
    jvm: 'from-blue-600 to-indigo-600 shadow-blue-600/20',
    ptl: 'from-indigo-600 to-violet-600 shadow-indigo-600/20',
    wap: 'from-cyan-600 to-blue-600 shadow-cyan-600/20',
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

const projectIsOverdue = (project: ProjectRecord) =>
    Boolean(project.due_date && !['completed', 'cancelled'].includes(project.status) && new Date(`${project.due_date}T23:59:59`) < new Date());

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

    const activeProjects = projects.filter((project) => project.status === 'in_progress').length;
    const overdueProjects = projects.filter(projectIsOverdue).length;
    const completedProjects = projects.filter((project) => project.status === 'completed').length;

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
            <CrmPageShell>
                <CrmPageHeader
                    title={`Проекты ${divisionLabel}`}
                    description="Портфель проектов, сроки, бюджет и команда направления"
                    icon={BriefcaseBusiness}
                    eyebrow={`ASTER · ${divisionLabel}`}
                    actions={
                        canCreate ? (
                            <Button onClick={openCreate} className="bg-white text-[#123864] shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                                <Plus className="size-4" />
                                Новый проект
                            </Button>
                        ) : undefined
                    }
                />

                <CrmStatsGrid>
                    <CrmStatCard
                        label="Все проекты"
                        value={projects.length}
                        hint={`Направление ${divisionLabel}`}
                        icon={BriefcaseBusiness}
                        tone="blue"
                    />
                    <CrmStatCard label="В работе" value={activeProjects} hint="Активная реализация" icon={Clock3} tone="cyan" />
                    <CrmStatCard label="Просрочено" value={overdueProjects} hint="Требуют внимания" icon={Calendar} tone="rose" />
                    <CrmStatCard label="Завершено" value={completedProjects} hint="Успешно закрыты" icon={CheckCircle2} tone="emerald" />
                </CrmStatsGrid>

                <CrmToolbar>
                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[minmax(18rem,1fr)_14rem_14rem_auto] xl:items-center">
                        <div className="relative">
                            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Поиск проекта, клиента или руководителя..."
                                className="border-slate-200 bg-slate-50/80 pl-9 shadow-none focus-visible:bg-white dark:border-white/10 dark:bg-white/5"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
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
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Все приоритеты</option>
                            {Object.entries(priorityLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <div className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                            Показано: <span className="font-semibold text-slate-800 dark:text-slate-200">{filtered.length}</span>
                        </div>
                    </div>
                </CrmToolbar>

                {filtered.length === 0 ? (
                    <EmptyState title="Проекты не найдены">Вам пока не назначены проекты или выбранные фильтры ничего не нашли.</EmptyState>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {filtered.map((project) => {
                            const teamNames = [project.manager.name, ...project.members.map((member) => member.name)];
                            const overdue = projectIsOverdue(project);

                            return (
                                <CrmSurface key={project.id} className="crm-card-hover group flex flex-col">
                                    <div className="relative overflow-hidden p-5 pb-4">
                                        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${divisionClasses[division]}`} />
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`flex size-8 items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-bold tracking-wide text-white shadow-lg ${divisionClasses[division]}`}
                                                >
                                                    {divisionLabel}
                                                </span>
                                                <Badge variant="outline" className={statusClasses[project.status]}>
                                                    {statusLabels[project.status]}
                                                </Badge>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    project.priority === 'high'
                                                        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'
                                                        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                                                }
                                            >
                                                {priorityLabels[project.priority]}
                                            </Badge>
                                        </div>
                                        <h3 className="mt-4 line-clamp-2 text-lg leading-snug font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                                            {project.name}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{project.client_name || 'Клиент не указан'}</p>
                                        {project.description && (
                                            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                                {project.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="mx-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50/80 p-3 text-xs dark:bg-white/[0.035]">
                                        <div>
                                            <div className="mb-1 flex items-center gap-1.5 text-slate-400">
                                                <Calendar className="size-3.5" />
                                                Срок
                                            </div>
                                            <div
                                                className={
                                                    overdue
                                                        ? 'font-semibold text-rose-600 dark:text-rose-300'
                                                        : 'font-medium text-slate-700 dark:text-slate-200'
                                                }
                                            >
                                                {project.due_date ? new Date(project.due_date).toLocaleDateString('ru-RU') : 'Не указан'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="mb-1 flex items-center gap-1.5 text-slate-400">
                                                <CircleDollarSign className="size-3.5" />
                                                Бюджет
                                            </div>
                                            <div className="truncate font-medium text-slate-700 dark:text-slate-200">
                                                {project.budget
                                                    ? `${Number(project.budget).toLocaleString('ru-RU')} ${project.budget_currency}`
                                                    : 'Не указан'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between gap-4 p-5">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <CrmAvatarStack names={teamNames} />
                                            <div className="min-w-0">
                                                <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                                                    {project.manager.name}
                                                </div>
                                                <div className="text-[11px] text-slate-400">{teamNames.length} в команде</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                            <ListChecks className="size-4 text-blue-600 dark:text-blue-300" />
                                            {project.tasks_count}
                                        </div>
                                    </div>

                                    {project.can_manage && (
                                        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/6">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="flex-1 justify-start text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-500/10"
                                                onClick={() => openEdit(project)}
                                            >
                                                <Pencil className="size-4" />
                                                Изменить
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                                onClick={() => remove(project)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    )}
                                </CrmSurface>
                            );
                        })}
                    </div>
                )}
            </CrmPageShell>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="crm-scrollbar max-h-[92vh] overflow-y-auto border-slate-200/70 bg-white/95 p-0 sm:max-w-3xl dark:border-white/10 dark:bg-slate-950/95">
                    <DialogHeader>
                        <div className="border-b border-slate-100 px-6 py-5 dark:border-white/8">
                            <div className="mb-1 text-[10px] font-semibold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-300">
                                ASTER · {divisionLabel}
                            </div>
                            <DialogTitle>{editing ? 'Редактировать проект' : `Новый проект ${divisionLabel}`}</DialogTitle>
                        </div>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4 px-6 pb-6">
                        <CrmFormSection title="Основная информация" description="Название, клиент и краткое описание проекта">
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
                        </CrmFormSection>

                        <CrmFormSection title="Управление" description="Статус, приоритет и ответственный руководитель">
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
                        </CrmFormSection>

                        <CrmFormSection title="Сроки и бюджет">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField label="Дата начала" error={errors.start_date}>
                                    <Input
                                        type="date"
                                        value={form.start_date}
                                        onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                                    />
                                </FormField>
                                <FormField label="Срок завершения" error={errors.due_date}>
                                    <Input
                                        type="date"
                                        value={form.due_date}
                                        onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                                    />
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
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                budget_currency: event.target.value as 'KZT' | 'USD',
                                            })
                                        }
                                        className="border-input bg-background h-9 rounded-md border px-3"
                                    >
                                        <option value="KZT">KZT</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </FormField>
                            </div>
                        </CrmFormSection>

                        <CrmFormSection title="Команда" description="Подчинённые и консультанты, участвующие в проекте">
                            <FormField label="Участники" error={errors.member_ids}>
                                <div className="crm-scrollbar grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-2 dark:border-white/10 dark:bg-white/[0.02]">
                                    {availableMembers.length === 0 ? (
                                        <span className="p-3 text-sm text-slate-500 dark:text-slate-400">
                                            Нет доступных подчинённых или консультантов.
                                        </span>
                                    ) : (
                                        availableMembers.map((member) => (
                                            <label
                                                key={member.id}
                                                className="flex items-start gap-2 rounded-lg p-2 transition hover:bg-blue-50 dark:hover:bg-blue-500/5"
                                            >
                                                <Checkbox
                                                    checked={form.member_ids.includes(member.id)}
                                                    onCheckedChange={(checked) => toggleMember(member.id, checked === true)}
                                                />
                                                <span className="min-w-0 text-sm">
                                                    <span className="block truncate font-medium">{member.name}</span>
                                                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                                        {member.roles?.join(', ') || member.email}
                                                    </span>
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </FormField>
                        </CrmFormSection>

                        <CrmFormSection title="Дополнительно">
                            <FormField label="Заметки" error={errors.notes}>
                                <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                            </FormField>
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
