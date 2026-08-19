import {
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
import { buildPriceOfferPdfBlob, formatAmount } from '@/lib/price-offer-pdf';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { CheckCircle2, Copy, Download, FileText, Search, Send, Trash2, Wallet } from 'lucide-react';
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

const emptyCopyForm = {
    client_id: '',
    recipient: '',
    director: '',
    address: '',
    phone: '',
    number: '',
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('ru-RU');

export default function PriceOffers({ offers, clients }: { offers: PriceOfferRecord[]; clients: ClientRecord[] }) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<'all' | PriceOfferStatus>('all');
    const [companyDetails, setCompanyDetails] = useState('Реквизиты компании не заполнены.');
    const [copySource, setCopySource] = useState<PriceOfferRecord | null>(null);
    const [copyForm, setCopyForm] = useState(emptyCopyForm);
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);
    const [generatingId, setGeneratingId] = useState<number | null>(null);
    const [pdfError, setPdfError] = useState('');

    useEffect(() => {
        axios
            .get<CompanyDetails>('/company-details/current')
            .then((response) => setCompanyDetails(response.data.formatted_details))
            .catch((error) => console.error('Ошибка при получении реквизитов компании:', error));
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
                    description="Журнал сформированных прайсов с возможностью повторной выгрузки и копирования на другого клиента"
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
                            <table className="w-full min-w-[1000px] text-sm">
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
                                            <td className="px-5 py-4 align-middle text-slate-600 dark:text-slate-300">
                                                {offer.items.length} поз.
                                            </td>
                                            <td className="px-5 py-4 text-right align-middle">
                                                <div className="font-semibold text-slate-900 dark:text-white">{formatAmount(Number(offer.total))} ₸</div>
                                                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                    без НДС {formatAmount(Number(offer.subtotal))} ₸
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 align-middle">
                                                <Badge variant="outline" className={statusBadgeClasses[offer.status]}>
                                                    {statusLabels[offer.status]}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-4 align-middle text-slate-600 dark:text-slate-300">
                                                {offer.creator?.name ?? '—'}
                                            </td>
                                            <td className="px-5 py-4 align-middle">
                                                <div className="flex justify-end gap-2">
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
                                                    <Button variant="outline" size="sm" onClick={() => openCopy(offer)} title="Копировать другому клиенту">
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
