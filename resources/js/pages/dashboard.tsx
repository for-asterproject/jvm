import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { buildPriceOfferPdfBlob, formatAmount, type InvoiceItem } from '@/lib/price-offer-pdf';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { saveAs } from 'file-saver';

// Хлебные крошки
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Прайс Лист',
        href: '/dashboard',
    },
];

// Интерфейс для продуктов
interface Product {
    id: number;
    name: string;
    is_service: boolean;
    vat_rate: number;
    price_USD_currency: number;
    vat_amount_USD_currency: number;
    price_with_vat_USD_currency: number;
    price_KZT_currency: number;
    vat_amount_KZT_currency: number;
    price_with_vat_KZT_currency: number;
}

interface CompanyDetails {
    formatted_details: string;
    vat_rate: number;
}

// Клиент из «Клиентской базы» для подстановки реквизитов получателя
interface ClientOption {
    id: number;
    company_name: string;
    division: string;
    contact_name: string | null;
    position: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    status: string;
}

// Главный компонент Dashboard
export default function Dashboard() {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
    const [exchangeRateUSD, setExchangeRateUSD] = useState<number | null>(null);
    const [companyDetails, setCompanyDetails] = useState<string>('Реквизиты компании не заполнены.');
    const [vatRate, setVatRate] = useState<number>(0);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState<boolean>(false);
    const [invoiceRecipient, setInvoiceRecipient] = useState<string>('');
    const [invoiceDirector, setInvoiceDirector] = useState<string>('');
    const [invoiceAddress, setInvoiceAddress] = useState<string>('');
    const [invoicePhone, setInvoicePhone] = useState<string>('');
    const [invoiceOriginPoint, setInvoiceOriginPoint] = useState<string>('Сеул');
    const [invoiceDeliveryPoint, setInvoiceDeliveryPoint] = useState<string>('Алматы');
    const [invoiceSupplyTerms, setInvoiceSupplyTerms] = useState<string>('EXW');
    const [invoicePrepaymentPercent, setInvoicePrepaymentPercent] = useState<string>('100');
    const [invoiceIncludeVat, setInvoiceIncludeVat] = useState<boolean>(true);
    const [invoiceNumber, setInvoiceNumber] = useState<string>('');
    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
    const [isInvoiceGenerating, setIsInvoiceGenerating] = useState<boolean>(false);
    const [pdfError, setPdfError] = useState<string>('');
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [nextOfferNumber, setNextOfferNumber] = useState<string>('');
    const [isSavingOffer, setIsSavingOffer] = useState<boolean>(false);
    const [saveMessage, setSaveMessage] = useState<string>('');
    const [savedOfferId, setSavedOfferId] = useState<number | null>(null);
    const [canSaveOffer, setCanSaveOffer] = useState<boolean>(false);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await axios.get('/products/price');
                setProducts(response.data);
            } catch (error) {
                console.error('Ошибка при получении данных:', error);
            }
        };

        const fetchExchangeRateUSD = async () => {
            try {
                const response = await axios.get('/exchange-rate/USD');
                setExchangeRateUSD(response.data.rate);
            } catch (error) {
                console.error('Ошибка при получении курса USD:', error);
            }
        };

        const fetchCompanyDetails = async () => {
            try {
                const response = await axios.get<CompanyDetails>('/company-details/current');
                setCompanyDetails(response.data.formatted_details);
                setVatRate(response.data.vat_rate);
            } catch (error) {
                console.error('Ошибка при получении реквизитов компании:', error);
            }
        };

        // Клиенты для подстановки получателя и следующий свободный номер предложения
        const fetchOfferFormOptions = async () => {
            try {
                const response = await axios.get<{ next_number: string; clients: ClientOption[] }>('/price-offers/form-options');
                setClients(response.data.clients);
                setNextOfferNumber(response.data.next_number);
                setCanSaveOffer(true);
            } catch (error) {
                // У консультантов нет доступа к журналу — прайс просто скачивается без сохранения
                console.error('Ошибка при получении данных для ценового предложения:', error);
            }
        };

        fetchProducts();
        fetchExchangeRateUSD();
        fetchCompanyDetails();
        fetchOfferFormOptions();
    }, []);

    const filteredProducts = products.filter((product) => selectedProducts.includes(product.id));

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70 },
        {
            field: 'is_service',
            headerName: 'Тип',
            width: 110,
            renderCell: (params) => (params.row.is_service ? 'Услуга' : 'Товар'),
        },
        { field: 'name', headerName: 'Название', width: 200 },
        { field: 'vat_rate', headerName: 'НДС (%)', type: 'number', width: 110 },
        { field: 'price_USD_currency', headerName: 'Без НДС (USD)', type: 'number', width: 150 },
        { field: 'price_with_vat_USD_currency', headerName: 'С НДС (USD)', type: 'number', width: 150 },
        { field: 'price_with_vat_KZT_currency', headerName: 'С НДС (KZT)', type: 'number', width: 150 },
    ];

    const handleInvoiceDialogOpen = (open: boolean) => {
        setIsInvoiceDialogOpen(open);

        if (open) {
            setPdfError('');
            setSaveMessage('');
            setSavedOfferId(null);
        }

        // Номер всегда берётся свободный — прошлый мог уже уйти в журнал
        if (open) {
            setInvoiceNumber(nextOfferNumber || `${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`);
        }

        if (open) {
            setInvoiceItems(
                filteredProducts
                    .slice()
                    .sort((leftProduct, rightProduct) => Number(leftProduct.is_service) - Number(rightProduct.is_service))
                    .map((product) => ({
                    id: product.id,
                    name: product.name,
                    is_service: product.is_service,
                    quantity: 1,
                    unitPrice: product.price_KZT_currency,
                }))
            );
        }
    };

    const handleInvoiceItemChange = (
        itemId: number,
        field: 'quantity' | 'unitPrice',
        value: string,
    ) => {
        const numericValue = Number(value);

        setInvoiceItems((currentItems) =>
            currentItems.map((item) =>
                item.id === itemId
                    ? {
                          ...item,
                          [field]: Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0,
                      }
                    : item,
            ),
        );
    };

    // Подстановка реквизитов получателя из «Клиентской базы»
    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);

        const client = clients.find((candidate) => String(candidate.id) === clientId);

        if (!client) {
            return;
        }

        setInvoiceRecipient(client.company_name);
        setInvoiceDirector(client.contact_name ?? '');
        setInvoiceAddress(client.address ?? '');
        setInvoicePhone(client.phone ?? '');
    };

    const isOfferReady = filteredProducts.length > 0 && invoiceRecipient.trim().length > 0 && invoiceItems.length > 0;

    const currentOfferNumber = invoiceNumber || `${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const buildPdfProps = () => ({
        items: invoiceItems,
        companyDetails,
        recipient: invoiceRecipient,
        director: invoiceDirector,
        address: invoiceAddress,
        phone: invoicePhone,
        originPoint: invoiceOriginPoint,
        deliveryPoint: invoiceDeliveryPoint,
        supplyTerms: invoiceSupplyTerms,
        prepaymentPercent: invoicePrepaymentPercent,
        includeVat: invoiceIncludeVat,
        vatRate,
        invoiceNumber: currentOfferNumber,
        invoiceDate: new Date().toLocaleDateString('ru-RU'),
    });

    // Запись предложения в журнал ценовых предложений
    const saveOfferToJournal = async () => {
        const response = await axios.post('/price-offers', {
            number: currentOfferNumber,
            offer_date: new Date().toISOString().slice(0, 10),
            client_id: selectedClientId ? Number(selectedClientId) : null,
            recipient: invoiceRecipient,
            director: invoiceDirector || null,
            address: invoiceAddress || null,
            phone: invoicePhone || null,
            origin_point: invoiceOriginPoint || null,
            delivery_point: invoiceDeliveryPoint || null,
            supply_terms: invoiceSupplyTerms || null,
            prepayment_percent: Number(invoicePrepaymentPercent) || 0,
            include_vat: invoiceIncludeVat,
            vat_rate: vatRate,
            exchange_rate_usd: exchangeRateUSD,
            status: 'draft',
            items: invoiceItems.map((item) => ({
                product_id: item.id,
                name: item.name,
                is_service: item.is_service,
                quantity: item.quantity,
                unit_price: item.unitPrice,
            })),
        });

        const offer = response.data.offer as { id: number; number: string };
        setSavedOfferId(offer.id);

        // Готовим свободный номер для следующего предложения
        axios
            .get<{ next_number: string; clients: ClientOption[] }>('/price-offers/form-options')
            .then((options) => setNextOfferNumber(options.data.next_number))
            .catch((error) => console.error('Ошибка при получении номера следующего предложения:', error));

        return offer;
    };

    const extractErrorMessage = (error: unknown, fallback: string) => {
        if (axios.isAxiosError(error)) {
            const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
            const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;

            return firstFieldError ?? data?.message ?? fallback;
        }

        return fallback;
    };

    const handleSaveOffer = async () => {
        if (!isOfferReady || savedOfferId !== null || !canSaveOffer) {
            return;
        }

        setPdfError('');
        setSaveMessage('');
        setIsSavingOffer(true);

        try {
            const offer = await saveOfferToJournal();
            setSaveMessage(`Предложение № ${offer.number} сохранено в журнал.`);
        } catch (error) {
            console.error('Ошибка при сохранении ценового предложения:', error);
            setPdfError(extractErrorMessage(error, 'Не удалось сохранить предложение в журнал.'));
        } finally {
            setIsSavingOffer(false);
        }
    };

    const handleInvoiceDownload = async () => {
        if (!isOfferReady) {
            return;
        }

        setPdfError('');
        setSaveMessage('');
        setIsInvoiceGenerating(true);

        try {
            const blob = await buildPriceOfferPdfBlob(buildPdfProps());

            saveAs(blob, `Invoice_${invoiceNumber || 'draft'}.pdf`);

            // Каждое выгруженное предложение попадает в журнал — но только один раз
            if (canSaveOffer && savedOfferId === null) {
                try {
                    await saveOfferToJournal();
                } catch (error) {
                    console.error('Ошибка при сохранении ценового предложения:', error);
                    setPdfError(extractErrorMessage(error, 'PDF скачан, но предложение не удалось сохранить в журнал.'));
                    return;
                }
            }

            setIsInvoiceDialogOpen(false);
        } catch (error) {
            console.error('Ошибка при формировании ценового предложения:', error);
            setPdfError('Не удалось сформировать PDF. Попробуйте ещё раз.');
        } finally {
            setIsInvoiceGenerating(false);
        }
    };

    const invoiceSubtotal = invoiceItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const invoiceVatAmount = invoiceIncludeVat ? invoiceSubtotal * vatRate / 100 : 0;
    const invoiceGrandTotal = invoiceSubtotal + invoiceVatAmount;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Прайс Лист" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                {/* Отображение текущего курса USD */}
                <div className="flex justify-end items-center">
                    <p style={{ marginRight: '20px', fontSize: '16px', fontWeight: 'bold' }}>
                        Курс USD: {exchangeRateUSD ? `${exchangeRateUSD}` : 'Загрузка...'}
                    </p>
                    <p style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        НДС: {vatRate}%
                    </p>
                </div>
                <div className="border-sidebar-border/70 dark:border-sidebar-border relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border md:min-h-min">
                    <div style={{ width: '100%' }}>
                        <div style={{ padding: '10px' }}>
                            <h2>Список продукции</h2>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    onClick={() => handleInvoiceDialogOpen(true)}
                                    disabled={filteredProducts.length === 0}
                                    className="bg-orange-600 text-white shadow-sm hover:bg-orange-700"
                                >
                                    Ценовое предложение
                                </Button>
                                {canSaveOffer ? (
                                    <Button asChild type="button" variant="outline">
                                        <Link href="/price-offers">Журнал предложений</Link>
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                        <DataGrid
                            rows={products}
                            columns={columns}
                            checkboxSelection
                            onRowSelectionModelChange={(newSelection) =>
                                setSelectedProducts([...newSelection] as number[])
                            }
                            pageSizeOptions={[25, 50, 100]}
                            initialState={{
                                pagination: { paginationModel: { pageSize: 25, page: 0 } },
                            }}
                            pagination
                        />
                    </div>
                </div>
            </div>

            <Dialog open={isInvoiceDialogOpen} onOpenChange={handleInvoiceDialogOpen}>
                <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-hidden p-0 sm:w-full sm:max-w-5xl">
                    <div className="flex max-h-[92vh] flex-col p-4 sm:p-6">
                        <DialogHeader className="shrink-0 border-b bg-background pb-4">
                            <DialogTitle>Сформировать ценовое предложение</DialogTitle>
                            <DialogDescription>
                                Заполните данные получателя и параметры ценового предложения.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1 sm:pr-2">
                        <div className="space-y-2">
                            <Label htmlFor="invoice-number">Номер инвойса</Label>
                            <Input
                                id="invoice-number"
                                value={invoiceNumber}
                                onChange={(event) => setInvoiceNumber(event.target.value)}
                                placeholder="Например, 2026-000123"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="invoice-client">Клиент из базы</Label>
                            <select
                                id="invoice-client"
                                value={selectedClientId}
                                onChange={(event) => handleClientSelect(event.target.value)}
                                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                            >
                                <option value="">Не выбран — заполнить вручную</option>
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.company_name} ({client.division.toUpperCase()})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                Выбор клиента подставит реквизиты ниже — их можно поправить вручную.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="invoice-recipient">Кому</Label>
                            <textarea
                                id="invoice-recipient"
                                value={invoiceRecipient}
                                onChange={(event) => setInvoiceRecipient(event.target.value)}
                                placeholder="Название организации, например: ПХВ Центр перинатологии и детской кардиохирургии"
                                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="invoice-director">Директор</Label>
                                <Input
                                    id="invoice-director"
                                    value={invoiceDirector}
                                    onChange={(event) => setInvoiceDirector(event.target.value)}
                                    placeholder="ФИО директора"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice-address">Адрес</Label>
                                <Input
                                    id="invoice-address"
                                    value={invoiceAddress}
                                    onChange={(event) => setInvoiceAddress(event.target.value)}
                                    placeholder="Адрес заказчика"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice-phone">Телефон</Label>
                                <Input
                                    id="invoice-phone"
                                    value={invoicePhone}
                                    onChange={(event) => setInvoicePhone(event.target.value)}
                                    placeholder="Контактный телефон"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="invoice-origin-point">Пункт отправки</Label>
                                <Input
                                    id="invoice-origin-point"
                                    value={invoiceOriginPoint}
                                    onChange={(event) => setInvoiceOriginPoint(event.target.value)}
                                    placeholder="Например, Сеул"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice-delivery-point">Пункт доставки</Label>
                                <Input
                                    id="invoice-delivery-point"
                                    value={invoiceDeliveryPoint}
                                    onChange={(event) => setInvoiceDeliveryPoint(event.target.value)}
                                    placeholder="Например, Алматы"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice-supply-terms">Условия поставки</Label>
                                <Input
                                    id="invoice-supply-terms"
                                    value={invoiceSupplyTerms}
                                    onChange={(event) => setInvoiceSupplyTerms(event.target.value)}
                                    placeholder="Например, EXW, FCA, FOB"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice-prepayment-percent">Предоплата (%)</Label>
                                <Input
                                    id="invoice-prepayment-percent"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={invoicePrepaymentPercent}
                                    onChange={(event) => setInvoicePrepaymentPercent(event.target.value)}
                                    placeholder="Например, 100"
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <Checkbox
                                id="invoice-vat"
                                checked={invoiceIncludeVat}
                                onCheckedChange={(checked) => {
                                    setInvoiceIncludeVat(checked === true);
                                }}
                            />
                            <Label htmlFor="invoice-vat">Формировать с учетом НДС</Label>
                        </div>

                        <div className="space-y-3">
                            <Label>Позиции инвойса</Label>
                            <div className="max-h-[34vh] space-y-3 overflow-y-auto rounded-md border p-3">
                                {invoiceItems.map((item, index) => (
                                    <div key={item.id} className="grid grid-cols-1 gap-3 rounded-md border p-3 lg:grid-cols-[48px_minmax(0,1fr)_120px_160px] lg:items-end">
                                        <div className="text-sm font-medium text-muted-foreground">{index + 1}</div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`invoice-item-name-${item.id}`}>Наименование</Label>
                                            <Input
                                                id={`invoice-item-name-${item.id}`}
                                                value={item.name}
                                                onChange={(event) =>
                                                    setInvoiceItems((currentItems) =>
                                                        currentItems.map((currentItem) =>
                                                            currentItem.id === item.id
                                                                ? { ...currentItem, name: event.target.value }
                                                                : currentItem,
                                                        ),
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`invoice-item-quantity-${item.id}`}>Количество</Label>
                                            <Input
                                                id={`invoice-item-quantity-${item.id}`}
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={item.quantity}
                                                onChange={(event) => handleInvoiceItemChange(item.id, 'quantity', event.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`invoice-item-price-${item.id}`}>Цена KZT</Label>
                                            <Input
                                                id={`invoice-item-price-${item.id}`}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.unitPrice}
                                                onChange={(event) => handleInvoiceItemChange(item.id, 'unitPrice', event.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        </div>

                        <div className="mt-4 shrink-0 rounded-md border bg-muted/30 p-4">
                            <div className="flex items-center justify-between gap-4 text-sm">
                                <span className="font-medium">Сумма без НДС</span>
                                <span className="text-right">{formatAmount(invoiceSubtotal)} KZT</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                                <span className="font-medium">НДС {invoiceIncludeVat ? `${vatRate}%` : 'не учитывается'}</span>
                                <span className="text-right">{formatAmount(invoiceVatAmount)} KZT</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-4 text-base font-semibold">
                                <span>Итого к оплате</span>
                                <span className="text-right">{formatAmount(invoiceGrandTotal)} KZT</span>
                            </div>
                        </div>

                        {pdfError ? (
                            <p className="mt-3 text-sm text-red-600" role="alert">
                                {pdfError}
                            </p>
                        ) : null}

                        {saveMessage ? (
                            <p className="mt-3 text-sm text-emerald-600" role="status">
                                {saveMessage}
                            </p>
                        ) : null}

                        <DialogFooter className="mt-4 shrink-0 border-t bg-background pt-4 sm:justify-end">
                            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => handleInvoiceDialogOpen(false)}>
                                Отмена
                            </Button>
                            {canSaveOffer ? (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full sm:w-auto"
                                    onClick={handleSaveOffer}
                                    disabled={!isOfferReady || isSavingOffer || isInvoiceGenerating || savedOfferId !== null}
                                >
                                    {savedOfferId !== null ? 'Сохранено' : isSavingOffer ? 'Сохранение...' : 'Сохранить в журнал'}
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                className="w-full sm:w-auto"
                                onClick={handleInvoiceDownload}
                                disabled={!isOfferReady || isInvoiceGenerating || isSavingOffer}
                            >
                                {isInvoiceGenerating
                                    ? 'Формирование...'
                                    : canSaveOffer && savedOfferId === null
                                      ? 'Сохранить и скачать PDF'
                                      : 'Скачать PDF'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
