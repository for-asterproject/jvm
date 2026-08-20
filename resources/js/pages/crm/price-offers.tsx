import {
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
import { buildPriceOfferPdfBlob, formatAmount } from '@/lib/price-offer-pdf';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { CheckCircle2, Copy, Download, FileText, Pencil, Plus, Search, Send, Trash2, Wallet } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ClientRecord, FormErrors, PriceOfferRecord, PriceOfferStatus } from './types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Ценовые предложения', href: '/price-offers' }];

const statusLabels: Record<PriceOfferStatus, string> = {
    draft: 'Черновик',
    sent: 'Отправлено',
    accepted: 'Принято',
    rejected: 'Отклонено',
};

const statusBadgeClasses: Record<PriceOfferStatus, string> = {
    draft: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200',
    sent: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200',
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200',
};

interface CompanyDetails {
    formatted_details: string;
    vat_rate: number;
}

// Позиция справочника — для добавления в предложение из прайса
interface ProductOption {
    id: number;
    name: string;
    is_service: boolean;
    price_KZT_currency: number;
}

// Строка позиции в форме: числа держим строками, чтобы поля свободно печатались
interface EditableItem {
    key: string;
    product_id: number | null;
    name: string;
    is_service: boolean;
    quantity: string;
    unit_price: string;
}

const emptyCopyForm = {
    client_id: '',
    recipient: '',
    director: '',
    address: '',
    phone: '',
    number: '',
};

const emptyEditForm = {
    number: '',
    offer_date: '',
    status: 'draft' as PriceOfferStatus,
    client_id: '',
    recipient: '',
    director: '',
    address: '',
    phone: '',
    origin_point: '',
    delivery_point: '',
    supply_terms: '',
    prepayment_percent: '100',
    include_vat: true,
    vat_rate: '0',
    notes: '',
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('ru-RU');

let itemKeySeed = 0;
const nextItemKey = () => `item-${++itemKeySeed}`;

export default function PriceOffers({ offers, clients }: { offers: PriceOfferRecord[]; clients: ClientRecord[] }) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<'all' | PriceOfferStatus>('all');
    const [companyDetails, setCompanyDetails] = useState('Реквизиты компании не заполнены.');
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [copySource, setCopySource] = useState<PriceOfferRecord | null>(null);
    const [copyForm, setCopyForm] = useState(emptyCopyForm);
    const [editing, setEditing] = useState<PriceOfferRecord | null>(null);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [editItems, setEditItems] = useState<EditableItem[]>([]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);
    const [generatingId, setGeneratingId] = useState<number | null>(null);
    const [pdfError, setPdfError] = useState('');

    useEffect(() => {
        axios
            .get<CompanyDetails>('/company-details/current')
            .then((response) => setCompanyDetails(response.data.formatted_details))
            .catch((error) => console.error('Ошибка при получении реквизитов компании:', error));

        axios
            .get<ProductOption[]>('/products/price')
            .then((response) => setProducts(response.data))
            .catch((error) => console.error('Ошибка при получении прайса:', error));
    }, []);

    const filteredOffers = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return offers.filter((offer) => {
            const matchesStatus = status === 'all' || offer.status === status;
            const haystack = [offer.number, offer.recipient, offer.client?.company_name, offer.director, offer.creator?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return matchesStatus && (!needle || haystack.includes(needle));
        });
    }, [offers, query, status]);

    const draftCount = offers.filter((offer) => offer.status === 'draft').length;
    const sentCount = offers.filter((offer) => offer.status === 'sent').length;
    const totalAmount = offers.reduce((sum, offer) => sum + Number(offer.total), 0);

    // Пересборка PDF из сохранённых в журнале данных
    const downloadPdf = async (offer: PriceOfferRecord) => {
        setPdfError('');
        setGeneratingId(offer.id);

        try {
            const blob = await buildPriceOfferPdfBlob({
                items: offer.items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    is_service: item.is_service,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unit_price),
                })),
                companyDetails,
                recipient: offer.recipient,
                director: offer.director ?? '',
                address: offer.address ?? '',
                phone: offer.phone ?? '',
                originPoint: offer.origin_point ?? '',
                deliveryPoint: offer.delivery_point ?? '',
                supplyTerms: offer.supply_terms ?? '',
                prepaymentPercent: String(offer.prepayment_percent),
                includeVat: offer.include_vat,
                vatRate: Number(offer.vat_rate),
                invoiceNumber: offer.number,
                invoiceDate: formatDate(offer.offer_date),
            });

            saveAs(blob, `Invoice_${offer.number}.pdf`);
        } catch (error) {
            console.error('Ошибка при формировании PDF:', error);
            setPdfError(`Не удалось сформировать PDF по предложению № ${offer.number}.`);
        } finally {
            setGeneratingId(null);
        }
    };

    const openCopy = (offer: PriceOfferRecord) => {
        setCopySource(offer);
        setCopyForm(emptyCopyForm);
        setErrors({});
    };

    // Выбор клиента подставляет его реквизиты в форму копии
    const selectCopyClient = (clientId: string) => {
        const client = clients.find((candidate) => String(candidate.id) === clientId);

        setCopyForm((current) => ({
            ...current,
            client_id: clientId,
            recipient: client ? client.company_name : current.recipient,
            director: client ? (client.contact_name ?? '') : current.director,
            address: client ? (client.address ?? '') : current.address,
            phone: client ? (client.phone ?? '') : current.phone,
        }));
    };

    const submitCopy = (event: FormEvent) => {
        event.preventDefault();

        if (!copySource) {
            return;
        }

        setProcessing(true);
        setErrors({});

        router.post(`/price-offers/${copySource.id}/duplicate`, copyForm, {
            preserveScroll: true,
            onSuccess: () => setCopySource(null),
            onError: (responseErrors: FormErrors) => setErrors(responseErrors),
            onFinish: () => setProcessing(false),
        });
    };

    const openEdit = (offer: PriceOfferRecord) => {
        setEditing(offer);
        setEditForm({
            number: offer.number,
            offer_date: offer.offer_date,
            status: offer.status,
            client_id: offer.client_id ? String(offer.client_id) : '',
            recipient: offer.recipient,
            director: offer.director ?? '',
            address: offer.address ?? '',
            phone: offer.phone ?? '',
            origin_point: offer.origin_point ?? '',
            delivery_point: offer.delivery_point ?? '',
            supply_terms: offer.supply_terms ?? '',
            prepayment_percent: String(offer.prepayment_percent),
            include_vat: offer.include_vat,
            vat_rate: String(Number(offer.vat_rate)),
            notes: offer.notes ?? '',
        });
        setEditItems(
            offer.items.map((item) => ({
                key: nextItemKey(),
                product_id: item.product_id,
                name: item.name,
                is_service: item.is_service,
                quantity: String(Number(item.quantity)),
                unit_price: String(Number(item.unit_price)),
            })),
        );
        setErrors({});
    };

    // Выбор клиента подставляет его реквизиты в форму редактирования
    const selectEditClient = (clientId: string) => {
        const client = clients.find((candidate) => String(candidate.id) === clientId);

        setEditForm((current) => ({
            ...current,
            client_id: clientId,
            recipient: client ? client.company_name : current.recipient,
            director: client ? (client.contact_name ?? '') : current.director,
            address: client ? (client.address ?? '') : current.address,
            phone: client ? (client.phone ?? '') : current.phone,
        }));
    };

    const changeEditItem = (key: string, patch: Partial<EditableItem>) => {
        setEditItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
    };

    const removeEditItem = (key: string) => {
        setEditItems((current) => current.filter((item) => item.key !== key));
    };

    const addBlankItem = () => {
        setEditItems((current) => [
            ...current,
            { key: nextItemKey(), product_id: null, name: '', is_service: false, quantity: '1', unit_price: '0' },
        ]);
    };

    // Добавление позиции из прайса с актуальной ценой в тенге
    const addProductItem = (productId: string) => {
        const product = products.find((candidate) => String(candidate.id) === productId);

        if (!product) {
            return;
        }

        setEditItems((current) => [
            ...current,
            {
                key: nextItemKey(),
                product_id: product.id,
                name: product.name,
                is_service: product.is_service,
                quantity: '1',
                unit_price: String(product.price_KZT_currency),
            },
        ]);
    };

    const editSubtotal = editItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
    const editVatAmount = editForm.include_vat ? (editSubtotal * (Number(editForm.vat_rate) || 0)) / 100 : 0;
    const editTotal = editSubtotal + editVatAmount;
    const hasItemErrors = Object.keys(errors).some((key) => key.startsWith('items'));

    const submitEdit = (event: FormEvent) => {
        event.preventDefault();

        if (!editing) {
            return;
        }

        setProcessing(true);
        setErrors({});

        router.put(
            `/price-offers/${editing.id}`,
            {
                ...editForm,
                prepayment_percent: Number(editForm.prepayment_percent) || 0,
                vat_rate: Number(editForm.vat_rate) || 0,
                client_id: editForm.client_id ? Number(editForm.client_id) : null,
                items: editItems.map((item) => ({
                    product_id: item.product_id,
                    name: item.name,
                    is_service: item.is_service,
                    quantity: Number(item.quantity) || 0,
                    unit_price: Number(item.unit_price) || 0,
                })),
            },
            {
                preserveScroll: true,
                onSuccess: () => setEditing(null),
                onError: (responseErrors: FormErrors) => setErrors(responseErrors),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const remove = (offer: PriceOfferRecord) => {
        if (!window.confirm(`Удалить ценовое предложение № ${offer.number}?`)) {
            return;
        }

        router.delete(`/price-offers/${offer.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Ценовые предложения" />
            <CrmPageShell>
                <CrmPageHeader
                    title="Ценовые предложения"
                    description="Журнал сформированных прайсов: редактирование, повторная выгрузка и копирование на другого клиента"
                    icon={FileText}
                    eyebrow="ASTER · OFFERS"
                    actions={
                        <Button asChild className="bg-white text-[#123864] shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                            <a href="/dashboard">К прайс-листу</a>
                        </Button>
                    }
                />

                <CrmStatsGrid>
                    <CrmStatCard label="Всего предложений" value={offers.length} hint="Записей в журнале" icon={FileText} tone="blue" />
                    <CrmStatCard label="Черновики" value={draftCount} hint="Ещё не отправлены" icon={CheckCircle2} tone="amber" />
                    <CrmStatCard label="Отправленные" value={sentCount} hint="Переданы клиенту" icon={Send} tone="emerald" />
                    <CrmStatCard label="Сумма с НДС" value={`${formatAmount(totalAmount)} ₸`} hint="По всем предложениям" icon={Wallet} tone="blue" />
                </CrmStatsGrid>

                <CrmToolbar>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Поиск по номеру, получателю, клиенту или автору..."
                                className="border-slate-200 bg-slate-50/80 pl-9 shadow-none focus-visible:bg-white dark:border-white/10 dark:bg-white/5"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value as 'all' | PriceOfferStatus)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                            <option value="all">Все статусы</option>
                            {Object.entries(statusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <div className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                            Найдено: <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredOffers.length}</span>
                        </div>
                    </div>
                </CrmToolbar>

                {pdfError ? (
                    <p className="text-sm text-rose-600" role="alert">
                        {pdfError}
                    </p>
                ) : null}

                {filteredOffers.length === 0 ? (
                    <EmptyState title="Предложения не найдены">
                        Сформируйте прайс на странице «Прайс Лист» и сохраните его в журнал.
                    </EmptyState>
                ) : (
                    <CrmSurface>
                        <div className="crm-scrollbar overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-sm">
                                <thead className="border-b border-slate-200/70 bg-slate-50/75 text-left dark:border-white/8 dark:bg-white/[0.025]">
                                    <tr className="text-[10px] tracking-[0.09em] text-slate-500 uppercase dark:text-slate-400">
                                        <th className="px-5 py-3.5 font-semibold">Номер / дата</th>
                                        <th className="px-5 py-3.5 font-semibold">Получатель</th>
                                        <th className="px-5 py-3.5 font-semibold">Позиции</th>
                                        <th className="px-5 py-3.5 text-right font-semibold">Сумма с НДС</th>
                                        <th className="px-5 py-3.5 font-semibold">Статус</th>
                                        <th className="px-5 py-3.5 font-semibold">Автор</th>
                                        <th className="px-5 py-3.5 text-right font-semibold">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/6">
                                    {filteredOffers.map((offer) => (
                                        <tr key={offer.id} className="group transition-colors hover:bg-blue-50/35 dark:hover:bg-blue-400/[0.035]">
                                            <td className="px-5 py-4 align-middle">
                                                <div className="font-semibold text-slate-900 dark:text-white">№ {offer.number}</div>
                                                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(offer.offer_date)}</div>
                                                {offer.copied_from ? (
                                                    <div className="mt-1 text-xs text-slate-400">копия № {offer.copied_from.number}</div>
                                                ) : null}
                                            </td>
                                            <td className="px-5 py-4 align-middle">
                                                <div className="font-medium text-slate-700 dark:text-slate-200">{offer.recipient}</div>
                                                {offer.client ? (
                                                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                        {offer.client.company_name} · {offer.client.division.toUpperCase()}
                                                    </div>
                                                ) : (
                                                    <div className="mt-0.5 text-xs text-slate-400">Без привязки к базе</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 align-middle text-slate-600 dark:text-slate-300">{offer.items.length} поз.</td>
                                            <td className="px-5 py-4 text-right align-middle">
                                                <div className="font-semibold text-slate-900 dark:text-white">
                                                    {formatAmount(Number(offer.total))} ₸
                                                </div>
                                                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                    без НДС {formatAmount(Number(offer.subtotal))} ₸
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 align-middle">
                                                <Badge variant="outline" className={statusBadgeClasses[offer.status]}>
                                                    {statusLabels[offer.status]}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-4 align-middle text-slate-600 dark:text-slate-300">{offer.creator?.name ?? '—'}</td>
                                            <td className="px-5 py-4 align-middle">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => openEdit(offer)} title="Редактировать прайс">
                                                        <Pencil className="size-4" />
                                                        Изменить
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => downloadPdf(offer)}
                                                        disabled={generatingId === offer.id}
                                                        title="Скачать PDF"
                                                    >
                                                        <Download className="size-4" />
                                                        {generatingId === offer.id ? 'PDF...' : 'PDF'}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openCopy(offer)}
                                                        title="Копировать другому клиенту"
                                                    >
                                                        <Copy className="size-4" />
                                                        Копия
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => remove(offer)}
                                                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                        title="Удалить"
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
                )}
            </CrmPageShell>

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto sm:w-full sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Редактирование предложения № {editing?.number}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={submitEdit} className="space-y-5">
                        <CrmFormSection title="Документ">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <FormField label="Номер" error={errors.number}>
                                    <Input
                                        value={editForm.number}
                                        onChange={(event) => setEditForm((current) => ({ ...current, number: event.target.value }))}
                                    />
                                </FormField>
                                <FormField label="Дата" error={errors.offer_date}>
                                    <Input
                                        type="date"
                                        value={editForm.offer_date}
                                        onChange={(event) => setEditForm((current) => ({ ...current, offer_date: event.target.value }))}
                                    />
                                </FormField>
                                <FormField label="Статус" error={errors.status}>
                                    <select
                                        value={editForm.status}
                                        onChange={(event) =>
                                            setEditForm((current) => ({ ...current, status: event.target.value as PriceOfferStatus }))
                                        }
                                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                                    >
                                        {Object.entries(statusLabels).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>
                            </div>
                        </CrmFormSection>

                        <CrmFormSection title="Получатель">
                            <div className="space-y-4">
                                <FormField label="Клиент из базы" error={errors.client_id}>
                                    <select
                                        value={editForm.client_id}
                                        onChange={(event) => selectEditClient(event.target.value)}
                                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                                    >
                                        <option value="">Не выбран — заполнить вручную</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {client.company_name} ({client.division.toUpperCase()})
                                            </option>
                                        ))}
                                    </select>
                                </FormField>

                                <FormField label="Кому" error={errors.recipient}>
                                    <Textarea
                                        value={editForm.recipient}
                                        onChange={(event) => setEditForm((current) => ({ ...current, recipient: event.target.value }))}
                                        className="min-h-20"
                                    />
                                </FormField>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    <FormField label="Директор" error={errors.director}>
                                        <Input
                                            value={editForm.director}
                                            onChange={(event) => setEditForm((current) => ({ ...current, director: event.target.value }))}
                                        />
                                    </FormField>
                                    <FormField label="Адрес" error={errors.address}>
                                        <Input
                                            value={editForm.address}
                                            onChange={(event) => setEditForm((current) => ({ ...current, address: event.target.value }))}
                                        />
                                    </FormField>
                                    <FormField label="Телефон" error={errors.phone}>
                                        <Input
                                            value={editForm.phone}
                                            onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                                        />
                                    </FormField>
                                </div>
                            </div>
                        </CrmFormSection>

                        <CrmFormSection title="Условия поставки и НДС">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                    <FormField label="Пункт отправки" error={errors.origin_point}>
                                        <Input
                                            value={editForm.origin_point}
                                            onChange={(event) => setEditForm((current) => ({ ...current, origin_point: event.target.value }))}
                                        />
                                    </FormField>
                                    <FormField label="Пункт доставки" error={errors.delivery_point}>
                                        <Input
                                            value={editForm.delivery_point}
                                            onChange={(event) => setEditForm((current) => ({ ...current, delivery_point: event.target.value }))}
                                        />
                                    </FormField>
                                    <FormField label="Условия поставки" error={errors.supply_terms}>
                                        <Input
                                            value={editForm.supply_terms}
                                            onChange={(event) => setEditForm((current) => ({ ...current, supply_terms: event.target.value }))}
                                        />
                                    </FormField>
                                    <FormField label="Предоплата (%)" error={errors.prepayment_percent}>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={editForm.prepayment_percent}
                                            onChange={(event) =>
                                                setEditForm((current) => ({ ...current, prepayment_percent: event.target.value }))
                                            }
                                        />
                                    </FormField>
                                </div>

                                <div className="flex flex-wrap items-end gap-6">
                                    <div className="flex items-center gap-3 pb-2">
                                        <Checkbox
                                            id="edit-include-vat"
                                            checked={editForm.include_vat}
                                            onCheckedChange={(checked) =>
                                                setEditForm((current) => ({ ...current, include_vat: checked === true }))
                                            }
                                        />
                                        <label htmlFor="edit-include-vat" className="text-sm text-slate-700 dark:text-slate-200">
                                            Формировать с учётом НДС
                                        </label>
                                    </div>
                                    <FormField label="Ставка НДС (%)" error={errors.vat_rate} className="w-40">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={editForm.vat_rate}
                                            onChange={(event) => setEditForm((current) => ({ ...current, vat_rate: event.target.value }))}
                                        />
                                    </FormField>
                                </div>
                            </div>
                        </CrmFormSection>

                        <CrmFormSection
                            title="Позиции прайса"
                            description="Наименования, количество и цены можно править, позиции — добавлять и удалять"
                        >
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button type="button" variant="outline" size="sm" onClick={addBlankItem}>
                                        <Plus className="size-4" />
                                        Добавить позицию
                                    </Button>
                                    <select
                                        value=""
                                        onChange={(event) => addProductItem(event.target.value)}
                                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 min-w-56 flex-1 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                                    >
                                        <option value="">Добавить из прайса...</option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.name} — {formatAmount(product.price_KZT_currency)} ₸
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {hasItemErrors ? (
                                    <p className="text-destructive text-xs" role="alert">
                                        Проверьте позиции: у каждой должны быть заполнены наименование, количество и цена.
                                    </p>
                                ) : null}

                                {editItems.length === 0 ? (
                                    <p className="rounded-md border border-dashed p-4 text-center text-sm text-slate-500">
                                        Нет позиций — добавьте хотя бы одну.
                                    </p>
                                ) : (
                                    <div className="max-h-[38vh] space-y-3 overflow-y-auto rounded-md border p-3">
                                        {editItems.map((item, index) => (
                                            <div
                                                key={item.key}
                                                className="grid grid-cols-1 gap-3 rounded-md border p-3 lg:grid-cols-[32px_minmax(0,1fr)_110px_100px_150px_44px] lg:items-end"
                                            >
                                                <div className="text-muted-foreground text-sm font-medium">{index + 1}</div>
                                                <FormField label="Наименование">
                                                    <Input
                                                        value={item.name}
                                                        onChange={(event) => changeEditItem(item.key, { name: event.target.value })}
                                                    />
                                                </FormField>
                                                <FormField label="Тип">
                                                    <select
                                                        value={item.is_service ? 'service' : 'product'}
                                                        onChange={(event) =>
                                                            changeEditItem(item.key, { is_service: event.target.value === 'service' })
                                                        }
                                                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                                                    >
                                                        <option value="product">Товар</option>
                                                        <option value="service">Услуга</option>
                                                    </select>
                                                </FormField>
                                                <FormField label="Кол-во">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={item.quantity}
                                                        onChange={(event) => changeEditItem(item.key, { quantity: event.target.value })}
                                                    />
                                                </FormField>
                                                <FormField label="Цена KZT">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.unit_price}
                                                        onChange={(event) => changeEditItem(item.key, { unit_price: event.target.value })}
                                                    />
                                                </FormField>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => removeEditItem(item.key)}
                                                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                    title="Удалить позицию"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CrmFormSection>

                        <FormField label="Примечание" error={errors.notes}>
                            <Textarea
                                value={editForm.notes}
                                onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                                className="min-h-16"
                                placeholder="Внутренний комментарий к предложению"
                            />
                        </FormField>

                        <div className="bg-muted/30 rounded-md border p-4">
                            <div className="flex items-center justify-between gap-4 text-sm">
                                <span className="font-medium">Сумма без НДС</span>
                                <span>{formatAmount(editSubtotal)} ₸</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                                <span className="font-medium">НДС {editForm.include_vat ? `${editForm.vat_rate}%` : 'не учитывается'}</span>
                                <span>{formatAmount(editVatAmount)} ₸</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-4 text-base font-semibold">
                                <span>Итого</span>
                                <span>{formatAmount(editTotal)} ₸</span>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing || editItems.length === 0}>
                                {processing ? 'Сохранение...' : 'Сохранить изменения'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={copySource !== null} onOpenChange={(open) => !open && setCopySource(null)}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Копия предложения № {copySource?.number} для другого клиента</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={submitCopy} className="space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Позиции и цены ({copySource?.items.length ?? 0} поз. на {formatAmount(Number(copySource?.total ?? 0))} ₸) переносятся
                            без изменений — меняется только получатель.
                        </p>

                        <FormField label="Клиент из базы" error={errors.client_id}>
                            <select
                                value={copyForm.client_id}
                                onChange={(event) => selectCopyClient(event.target.value)}
                                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                            >
                                <option value="">Не выбран — заполнить вручную</option>
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.company_name} ({client.division.toUpperCase()})
                                    </option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Кому" error={errors.recipient}>
                            <Textarea
                                value={copyForm.recipient}
                                onChange={(event) => setCopyForm((current) => ({ ...current, recipient: event.target.value }))}
                                placeholder="Название организации получателя"
                                className="min-h-20"
                            />
                        </FormField>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <FormField label="Директор" error={errors.director}>
                                <Input
                                    value={copyForm.director}
                                    onChange={(event) => setCopyForm((current) => ({ ...current, director: event.target.value }))}
                                    placeholder="ФИО директора"
                                />
                            </FormField>
                            <FormField label="Адрес" error={errors.address}>
                                <Input
                                    value={copyForm.address}
                                    onChange={(event) => setCopyForm((current) => ({ ...current, address: event.target.value }))}
                                    placeholder="Адрес заказчика"
                                />
                            </FormField>
                            <FormField label="Телефон" error={errors.phone}>
                                <Input
                                    value={copyForm.phone}
                                    onChange={(event) => setCopyForm((current) => ({ ...current, phone: event.target.value }))}
                                    placeholder="Контактный телефон"
                                />
                            </FormField>
                        </div>

                        <FormField label="Номер нового предложения" error={errors.number}>
                            <Input
                                value={copyForm.number}
                                onChange={(event) => setCopyForm((current) => ({ ...current, number: event.target.value }))}
                                placeholder="Оставьте пустым — номер присвоится автоматически"
                            />
                        </FormField>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCopySource(null)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Создание...' : 'Создать копию'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
