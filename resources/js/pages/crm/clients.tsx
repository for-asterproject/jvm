import { CrmPageHeader, EmptyState, FormField } from '@/components/crm/crm-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Building2, Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
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
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <CrmPageHeader
                    title="Клиентская база"
                    description="Компании и контактные лица"
                    actions={
                        <Button onClick={openCreate}>
                            <Plus className="size-4" />
                            Добавить клиента
                        </Button>
                    }
                />

                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Поиск по компании, БИН, контакту..."
                            className="pl-9"
                        />
                    </div>
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                        <option value="all">Все статусы</option>
                        <option value="active">Активные</option>
                        <option value="inactive">Неактивные</option>
                    </select>
                </div>

                {filteredClients.length === 0 ? (
                    <EmptyState>Клиенты не найдены. Добавьте первую компанию или измените фильтры.</EmptyState>
                ) : (
                    <div className="overflow-hidden rounded-xl border">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-sm">
                                <thead className="bg-muted/50 text-left">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Компания</th>
                                        <th className="px-4 py-3 font-medium">Контакт</th>
                                        <th className="px-4 py-3 font-medium">Связь</th>
                                        <th className="px-4 py-3 font-medium">Статус</th>
                                        <th className="px-4 py-3 text-right font-medium">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredClients.map((client) => (
                                        <tr key={client.id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 align-top">
                                                <div className="flex gap-3">
                                                    <Building2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                                    <div>
                                                        <div className="font-medium">{client.company_name}</div>
                                                        {client.bin && <div className="text-muted-foreground text-xs">БИН {client.bin}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <div>{client.contact_name || '—'}</div>
                                                {client.position && <div className="text-muted-foreground text-xs">{client.position}</div>}
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                {client.phone && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Phone className="size-3.5" />
                                                        {client.phone}
                                                    </div>
                                                )}
                                                {client.email && (
                                                    <div className="mt-1 flex items-center gap-1.5">
                                                        <Mail className="size-3.5" />
                                                        {client.email}
                                                    </div>
                                                )}
                                                {!client.phone && !client.email && '—'}
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                                                    {client.status === 'active' ? 'Активный' : 'Неактивный'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEdit(client)}>
                                                        <Pencil className="size-4" />
                                                        Изменить
                                                    </Button>
                                                    <Button size="sm" variant="destructive" onClick={() => remove(client)}>
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Редактировать клиента' : 'Новый клиент'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField label="Компания" required error={errors.company_name}>
                                <Input value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} />
                            </FormField>
                            <FormField label="БИН" error={errors.bin}>
                                <Input value={form.bin} onChange={(event) => setForm({ ...form, bin: event.target.value })} />
                            </FormField>
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
