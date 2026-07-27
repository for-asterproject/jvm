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
import { ContactRound, Mail, Pencil, Phone, Plus, Search, Trash2, UserCheck, UserMinus, UsersRound } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { ClientRecord, FormErrors } from './types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Клиентская база', href: '/clients' }];

const emptyForm = {
    company_name: '',
    bin: '',
    contact_name: '',
    position: '',
    phone: '',
    email: '',
    address: '',
    status: 'active' as 'active' | 'inactive',
    notes: '',
};

export default function Clients({ clients }: { clients: ClientRecord[] }) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ClientRecord | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);

    const filteredClients = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return clients.filter((client) => {
            const matchesStatus = status === 'all' || client.status === status;
            const haystack = [client.company_name, client.bin, client.contact_name, client.phone, client.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return matchesStatus && (!needle || haystack.includes(needle));
        });
    }, [clients, query, status]);
    const activeClients = clients.filter((client) => client.status === 'active').length;
    const inactiveClients = clients.length - activeClients;
    const clientsWithoutContact = clients.filter((client) => !client.phone && !client.email).length;

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (client: ClientRecord) => {
        setEditing(client);
        setForm({
            company_name: client.company_name,
            bin: client.bin ?? '',
            contact_name: client.contact_name ?? '',
            position: client.position ?? '',
            phone: client.phone ?? '',
            email: client.email ?? '',
            address: client.address ?? '',
            status: client.status,
            notes: client.notes ?? '',
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
            router.put(`/clients/${editing.id}`, form, options);
        } else {
            router.post('/clients', form, options);
        }
    };

    const remove = (client: ClientRecord) => {
        if (!window.confirm(`Удалить клиента «${client.company_name}»?`)) {
            return;
        }

        router.delete(`/clients/${client.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Клиентская база" />
            <CrmPageShell>
                <CrmPageHeader
                    title="Клиентская база"
                    description="Единое пространство для компаний, контактов и истории взаимодействия"
                    icon={UsersRound}
                    eyebrow="ASTER · CLIENTS"
                    actions={
                        <Button onClick={openCreate} className="bg-white text-[#123864] shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                            <Plus className="size-4" />
                            Добавить клиента
                        </Button>
                    }
                />

                <CrmStatsGrid>
                    <CrmStatCard label="Всего клиентов" value={clients.length} hint="Компаний в базе" icon={UsersRound} tone="blue" />
                    <CrmStatCard label="Активные" value={activeClients} hint="В текущей работе" icon={UserCheck} tone="emerald" />
                    <CrmStatCard label="Неактивные" value={inactiveClients} hint="В архивном статусе" icon={UserMinus} tone="amber" />
                    <CrmStatCard label="Без контакта" value={clientsWithoutContact} hint="Нет телефона и email" icon={ContactRound} tone="rose" />
                </CrmStatsGrid>

                <CrmToolbar>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Поиск по компании, БИН или контакту..."
                                className="border-slate-200 bg-slate-50/80 pl-9 shadow-none focus-visible:bg-white dark:border-white/10 dark:bg-white/5"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Все статусы</option>
                            <option value="active">Активные</option>
                            <option value="inactive">Неактивные</option>
                        </select>
                        <div className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                            Найдено: <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredClients.length}</span>
                        </div>
                    </div>
                </CrmToolbar>

                {filteredClients.length === 0 ? (
                    <EmptyState title="Клиенты не найдены">Добавьте первую компанию или измените параметры поиска.</EmptyState>
                ) : (
                    <>
                        <CrmSurface className="hidden md:block">
                            <div className="crm-scrollbar overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead className="border-b border-slate-200/70 bg-slate-50/75 text-left dark:border-white/8 dark:bg-white/[0.025]">
                                        <tr className="text-[10px] tracking-[0.09em] text-slate-500 uppercase dark:text-slate-400">
                                            <th className="px-5 py-3.5 font-semibold">Компания</th>
                                            <th className="px-5 py-3.5 font-semibold">Контакт</th>
                                            <th className="px-5 py-3.5 font-semibold">Связь</th>
                                            <th className="px-5 py-3.5 font-semibold">Статус</th>
                                            <th className="px-5 py-3.5 text-right font-semibold">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-white/6">
                                        {filteredClients.map((client) => (
                                            <tr
                                                key={client.id}
                                                className="group transition-colors hover:bg-blue-50/35 dark:hover:bg-blue-400/[0.035]"
                                            >
                                                <td className="px-5 py-4 align-middle">
                                                    <div className="flex items-center gap-3">
                                                        <CrmAvatar name={client.company_name} />
                                                        <div className="min-w-0">
                                                            <div className="truncate font-semibold text-slate-900 dark:text-white">
                                                                {client.company_name}
                                                            </div>
                                                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                                {client.bin ? `БИН ${client.bin}` : 'БИН не указан'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    <div className="font-medium text-slate-700 dark:text-slate-200">
                                                        {client.contact_name || 'Не указан'}
                                                    </div>
                                                    {client.position && (
                                                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{client.position}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                                        {client.phone && (
                                                            <div className="flex items-center gap-2">
                                                                <Phone className="size-3.5 text-blue-600 dark:text-blue-300" />
                                                                {client.phone}
                                                            </div>
                                                        )}
                                                        {client.email && (
                                                            <div className="flex items-center gap-2">
                                                                <Mail className="size-3.5 text-blue-600 dark:text-blue-300" />
                                                                {client.email}
                                                            </div>
                                                        )}
                                                        {!client.phone && !client.email && <span className="text-slate-400">Нет контактов</span>}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            client.status === 'active'
                                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                                                        }
                                                    >
                                                        <span
                                                            className={
                                                                client.status === 'active'
                                                                    ? 'size-1.5 rounded-full bg-emerald-500'
                                                                    : 'size-1.5 rounded-full bg-slate-400'
                                                            }
                                                        />
                                                        {client.status === 'active' ? 'Активный' : 'Неактивный'}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    <div className="flex justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-8 text-slate-500 hover:text-blue-700"
                                                            onClick={() => openEdit(client)}
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                                            onClick={() => remove(client)}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CrmSurface>

                        <div className="grid gap-3 md:hidden">
                            {filteredClients.map((client) => (
                                <CrmSurface key={client.id} className="crm-card-hover p-4">
                                    <div className="flex items-start gap-3">
                                        <CrmAvatar name={client.company_name} className="size-10 rounded-2xl" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h3 className="font-semibold text-slate-900 dark:text-white">{client.company_name}</h3>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {client.bin ? `БИН ${client.bin}` : 'БИН не указан'}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        client.status === 'active'
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                            : 'border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-300'
                                                    }
                                                >
                                                    {client.status === 'active' ? 'Активный' : 'Неактивный'}
                                                </Badge>
                                            </div>
                                            <div className="mt-3 grid gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                                <div className="font-medium">{client.contact_name || 'Контакт не указан'}</div>
                                                {client.phone && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="size-3.5 text-blue-600" />
                                                        {client.phone}
                                                    </div>
                                                )}
                                                {client.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="size-3.5 text-blue-600" />
                                                        {client.email}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-white/6">
                                                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(client)}>
                                                    <Pencil className="size-3.5" /> Изменить
                                                </Button>
                                                <Button size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => remove(client)}>
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CrmSurface>
                            ))}
                        </div>
                    </>
                )}
            </CrmPageShell>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="crm-scrollbar max-h-[90vh] overflow-y-auto border-slate-200/70 bg-white/95 p-0 sm:max-w-2xl dark:border-white/10 dark:bg-slate-950/95">
                    <DialogHeader>
                        <div className="border-b border-slate-100 px-6 py-5 dark:border-white/8">
                            <div className="mb-1 text-[10px] font-semibold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-300">
                                ASTER · CLIENTS
                            </div>
                            <DialogTitle>{editing ? 'Редактировать клиента' : 'Новый клиент'}</DialogTitle>
                        </div>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4 px-6 pb-6">
                        <CrmFormSection title="Компания" description="Основные реквизиты и текущий статус">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField label="Компания" required error={errors.company_name}>
                                    <Input value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} />
                                </FormField>
                                <FormField label="БИН" error={errors.bin}>
                                    <Input value={form.bin} onChange={(event) => setForm({ ...form, bin: event.target.value })} />
                                </FormField>
                                <FormField label="Статус" required error={errors.status}>
                                    <select
                                        value={form.status}
                                        onChange={(event) => setForm({ ...form, status: event.target.value as 'active' | 'inactive' })}
                                        className="border-input bg-background h-9 rounded-md border px-3"
                                    >
                                        <option value="active">Активный</option>
                                        <option value="inactive">Неактивный</option>
                                    </select>
                                </FormField>
                                <FormField label="Адрес" error={errors.address}>
                                    <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
                                </FormField>
                            </div>
                        </CrmFormSection>
                        <CrmFormSection title="Контактное лицо" description="Данные для быстрой связи">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField label="Контактное лицо" error={errors.contact_name}>
                                    <Input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} />
                                </FormField>
                                <FormField label="Должность" error={errors.position}>
                                    <Input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
                                </FormField>
                                <FormField label="Телефон" error={errors.phone}>
                                    <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                                </FormField>
                                <FormField label="Email" error={errors.email}>
                                    <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                                </FormField>
                            </div>
                        </CrmFormSection>
                        <CrmFormSection title="Заметки">
                            <FormField label="Комментарий" error={errors.notes}>
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
