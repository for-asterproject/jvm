import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
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
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useUser } from '@/components/UserContext';
import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Page, Text, View, Document, pdf, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

// Хлебные крошки
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Прайс-лист',
        href: '/dashboard',
    },
];

// Регистрируем шрифт с поддержкой кириллицы
import RobotoRegular from '@/fonts/Roboto-Regular.ttf';

Font.register({
    family: 'Roboto',
    src: RobotoRegular,
});

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

interface User {
    name: string;
    email?: string;
}

interface CompanyDetails {
    formatted_details: string;
    vat_rate: number;
}

interface InvoicePDFProps {
    items: InvoiceItem[];
    user: User;
    companyDetails: string;
    recipient: string;
    director: string;
    address: string;
    phone: string;
    originPoint: string;
    deliveryPoint: string;
    supplyTerms: string;
    prepaymentPercent: string;
    includeVat: boolean;
    vatRate: number;
    invoiceNumber: string;
    invoiceDate: string;
}

interface InvoiceItem {
    id: number;
    name: string;
    is_service: boolean;
    quantity: number;
    unitPrice: number;
}

// Стили для PDF
const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 12,
        fontFamily: 'Roboto',
    },
    logo: {
        width: 135,
        height: 58,
        marginBottom: 20,
        alignSelf: 'center',
    },
    header: {
        fontSize: 18,
        fontWeight: 800,
        textAlign: 'center',
        marginBottom: 20,
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    table: {
        marginVertical: 10,
    },
    tableRow: {
        flexDirection: 'row',
    },
    tableCol: {
        width: '25%',
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'right',
        padding: 5,
    },
    tableColID: {
        width: '10%',
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'center',
        padding: 5,
    },
    tableColName: {
        width: '40%',
        borderWidth: 1,
        borderColor: '#000',
        padding: 5,
    },
    tableHeader: {
        fontWeight: 'bold',
        backgroundColor: '#f0f0f0',
    },
    footer: {
        marginTop: 20,
        textAlign: 'right',
        fontSize: 12,
    },
    summaryBlock: {
        marginTop: 16,
        marginLeft: 'auto',
        width: '52%',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#d4d4d8',
        paddingVertical: 4,
    },
    summaryLabel: {
        fontWeight: 'bold',
    },
    invoiceHeadingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
        gap: 16,
    },
    invoiceCompanyBlock: {
        width: '54%',
        fontSize: 10,
        lineHeight: 1.35,
    },
    invoiceMetaBlock: {
        width: '42%',
        alignItems: 'flex-end',
    },
    invoiceTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#111827',
    },
    invoiceMetaText: {
        fontSize: 11,
        color: '#374151',
        marginBottom: 4,
    },
    recipientBox: {
        // borderWidth: 1,
        // borderColor: '#9ca3af',
        padding: 3,
        marginBottom: 10,
    },
    recipientLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 6,
    },
    recipientText: {
        fontSize: 11,
        color: '#111827',
        marginBottom: 2,
    },
    invoiceInfoTable: {
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#d4d4d8',
    },
    invoiceInfoRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#d4d4d8',
    },
    invoiceInfoHeaderCell: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        padding: 6,
        fontSize: 9,
        fontWeight: 'bold',
        borderRightWidth: 1,
        borderRightColor: '#d4d4d8',
    },
    invoiceInfoValueCell: {
        flex: 1,
        padding: 6,
        fontSize: 9,
        borderRightWidth: 1,
        borderRightColor: '#d4d4d8',
    },
    invoiceInfoValueCellWide: {
        flex: 1,
        padding: 6,
        fontSize: 9,
        borderRightWidth: 0,
        lineHeight: 1.35,
    },
    invoiceItemIdCol: {
        width: '6%',
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'center',
        padding: 4,
        fontSize: 8,
        lineHeight: 1.2,
    },
    invoiceItemNameCol: {
        width: '42%',
        borderWidth: 1,
        borderColor: '#000',
        padding: 4,
        fontSize: 8,
        lineHeight: 1.25,
    },
    invoiceItemQtyCol: {
        width: '10%',
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'center',
        padding: 4,
        fontSize: 8,
        lineHeight: 1.2,
    },
    invoiceItemPriceCol: {
        width: '14%',
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'right',
        padding: 4,
        fontSize: 7.5,
        lineHeight: 1.2,
    },
    invoiceItemSubtotalCol: {
        width: '14%',
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'right',
        padding: 4,
        fontSize: 7.5,
        lineHeight: 1.2,
    },
    invoiceItemTotalCol: {
        width: '14%',
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'right',
        padding: 4,
        fontSize: 7.5,
        lineHeight: 1.2,
    },
    invoiceTerms: {
        marginTop: 16,
        fontSize: 10,
        lineHeight: 1.4,
    },
    invoiceSectionRow: {
        borderWidth: 1,
        borderColor: '#000',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 6,
        paddingVertical: 5,
    },
    invoiceSectionText: {
        fontSize: 8.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    invoiceSubtotalLabelCol: {
        width: '72%',
        borderWidth: 1,
        borderColor: '#000',
        padding: 4,
        fontSize: 8,
        fontWeight: 'bold',
    },
    invoiceSubtotalValueCol: {
        width: '14%',
        borderWidth: 1,
        borderColor: '#000',
        textAlign: 'right',
        padding: 4,
        fontSize: 7.5,
        fontWeight: 'bold',
        lineHeight: 1.2,
    },
    marketingBlock: {
        marginTop: 12,
    },
    marketingPageTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#111827',
    },
    marketingIntro: {
        fontSize: 9.5,
        lineHeight: 1.4,
        marginBottom: 6,
    },
    marketingItem: {
        marginBottom: 8,
    },
    marketingItemTitle: {
        fontSize: 9,
        fontWeight: 'bold',
        lineHeight: 1.35,
        marginBottom: 3,
    },
    marketingItemDescription: {
        fontSize: 8.4,
        lineHeight: 1.4,
        marginBottom: 3,
    },
    marketingBullet: {
        fontSize: 8.2,
        lineHeight: 1.42,
        marginBottom: 2,
        paddingLeft: 8,
    },
});

const marketingServices = [
    {
        title: 'Предпроектное консультационное сопровождение',
        description: 'Данный этап является фундаментом проекта и входит в общую стоимость. Мы обеспечиваем:',
        bullets: [
            'Аудит помещений: Технический осмотр локаций под установку оборудования с учетом норм санитарно-эпидемиологического контроля.',
            'Подбор моделей: Анализ коечного фонда и оборота медикаментов для выбора оптимальной мощности системы (количество кассет и скорость фасовки).',
            'Планировка и планограмма: Разработка детальных схем размещения оборудования и организация эргономичных рабочих мест для фармацевтов и операторов.',
        ],
    },
    {
        title: 'Сопровождение НПА и государственных закупок',
        description: 'Мы берем на себя экспертную поддержку при прохождении бюрократических процедур:',
        bullets: [
            'Работа с НПА: Консультации по приведению внутренних регламентов больницы в соответствие с законодательством в области автоматизации лекарственного обеспечения.',
            'Техническая спецификация: Помощь в формировании грамотного технического задания для процедур госзакупок (ГЗ), исключающего риски поставки некачественного оборудования.',
            'Юридический контроль: Сопровождение процесса согласования документации на всех этапах тендерного цикла.',
        ],
    },
    {
        title: 'Установка, монтаж и дополнительная оснастка',
        description: 'Комплексная реализация «под ключ», включающая:',
        bullets: [
            'Инсталляция: Монтаж основного блока JVM и настройка прецизионных узлов.',
            'Периферийная техника: Поставка и настройка специализированных принтеров этикеток, сканеров штрих-кодов для верификации и терминалов сбора данных.',
            'Навигация: Установка систем указателей и маркировка зон хранения (планограмма стеллажного хранения).',
            'Рекомендации: Подбор вспомогательной мебели (антистатические столы, шкафы) и климатического оборудования для серверных узлов.',
        ],
    },
    {
        title: 'IT-интеграция, документация и обучение',
        bullets: [
            'Синхронизация с КИС: Полная интеграция софта JVM с вашей медицинской информационной системой (1С:Медицина, Damumed или аналогами) для обмена данными о назначениях.',
            'Пакет документов: Передача полных руководств по эксплуатации, технических паспортов и санитарных сертификатов.',
            'Обучение персонала: Проведение практических тренингов для фармацевтов аптеки и IT-специалистов (администрирование базы данных, замена расходных материалов, регламентное обслуживание).',
        ],
    },
    {
        title: 'Гарантийное и сервисное обслуживание',
        bullets: [
            'Срок: 12 месяцев полной гарантии с момента ввода в эксплуатацию.',
            'Выездной сервис: В случае неисправности обеспечивается оперативный выезд квалифицированных инженеров, имеющих допуск к обслуживанию высокотехнологичных медицинских систем.',
            'Поддержка: Удаленная техническая диагностика и обновление ПО.',
        ],
    },
    {
        title: 'Обучающий визит в Южную Корею',
        description: 'В рамках долгосрочного партнерства организуется выезд 2-х ведущих специалистов вашей организации (клинического фармаколога / главного врача / руководителя проекта) в Южную Корею:',
        bullets: [
            'Посещение завода JVM: Ознакомление с процессом производства и контроля качества.',
            'Clinical Tour: 3х дневный визит в ведущие клиники Сеула, где системы JVM работают в промышленном масштабе.',
            'Цель: Обмен опытом по оптимизации логистики внутри больницы и получению максимального экономического эффекта от внедрения.',
        ],
    },
];

const formatAmount = (value: number) => {
    const normalizedValue = Number.isFinite(value) ? value : 0;

    return normalizedValue
        .toLocaleString('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
        .replace(/[\u00A0\u202F]/g, ' ');
};

// Компонент PDF
const CommercialOfferPDF: React.FC<{ selectedProducts: Product[]; user: User; exchangeRateUSD: number; companyDetails: string; vatRate: number }> = ({ selectedProducts, user, exchangeRateUSD, companyDetails, vatRate }) => {
    const totalWithoutVatUsd = selectedProducts.reduce((sum, product) => sum + product.price_USD_currency, 0);
    const totalWithoutVatKzt = selectedProducts.reduce((sum, product) => sum + product.price_KZT_currency, 0);
    const totalVatKzt = selectedProducts.reduce((sum, product) => sum + product.vat_amount_KZT_currency, 0);
    const totalWithVatKzt = selectedProducts.reduce((sum, product) => sum + product.price_with_vat_KZT_currency, 0);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Image style={styles.logo} src="/aster-logo.png" />
                <Text style={styles.dateRow}>{companyDetails}</Text>
                <Text style={styles.header}>Коммерческое предложение</Text>
                <View style={styles.dateRow}>
                    <Text>Дата: {new Date().toLocaleDateString()}</Text>
                    <Text>Курс USD: {exchangeRateUSD}</Text>
                </View>
                <Text style={{ marginBottom: 10 }}>Ставка НДС: {vatRate}%</Text>
                <View style={styles.table}>
                    <View style={styles.tableRow}>
                        <Text style={[styles.tableColID, styles.tableHeader]}>ID</Text>
                        <Text style={[styles.tableColName, styles.tableHeader]}>Название</Text>
                        <Text style={[styles.tableCol, styles.tableHeader]}>Без НДС (USD)</Text>
                        <Text style={[styles.tableCol, styles.tableHeader]}>С НДС (KZT)</Text>
                    </View>
                    {selectedProducts.map((product) => (
                        <View key={product.id} style={styles.tableRow}>
                            <Text style={styles.tableColID}>{product.id}</Text>
                            <Text style={styles.tableColName}>{product.name}</Text>
                            <Text style={styles.tableCol}>{formatAmount(product.price_USD_currency)} USD</Text>
                            <Text style={styles.tableCol}>{formatAmount(product.price_with_vat_KZT_currency)} KZT</Text>
                        </View>
                    ))}
                </View>
                <View style={styles.summaryBlock}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Итого без НДС:</Text>
                        <Text>{formatAmount(totalWithoutVatUsd)} USD / {formatAmount(totalWithoutVatKzt)} KZT</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Итого НДС:</Text>
                        <Text>{formatAmount(totalVatKzt)} KZT</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Итого с НДС:</Text>
                        <Text>{formatAmount(totalWithVatKzt)} KZT</Text>
                    </View>
                </View>
                <Text style={styles.footer}>
                    Предложение подготовил: {user.name} {"(" + user.email + ")"}
                </Text>
            </Page>
        </Document>
    );
};

const InvoicePDF: React.FC<InvoicePDFProps> = ({
    items,
    user,
    companyDetails,
    recipient,
    director,
    address,
    phone,
    originPoint,
    deliveryPoint,
    supplyTerms,
    prepaymentPercent,
    includeVat,
    vatRate,
    invoiceNumber,
    invoiceDate,
}) => {
    const totalWithoutVat = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalVat = includeVat
        ? totalWithoutVat * vatRate / 100
        : 0;
    const totalWithVat = includeVat ? totalWithoutVat + totalVat : totalWithoutVat;
    const productItems = items.filter((item) => !item.is_service);
    const serviceItems = items.filter((item) => item.is_service);

    const recipientLines = recipient
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const recipientDetails = [
        director ? `Директор: ${director}` : null,
        address ? `Адрес: ${address}` : null,
        phone ? phone : null,
    ].filter(Boolean) as string[];

    const renderInvoiceSection = (sectionTitle: string, sectionItems: InvoiceItem[], startIndex: number) => {
        if (sectionItems.length === 0) {
            return null;
        }

        const sectionSubtotal = sectionItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const sectionTotalWithVat = includeVat
            ? sectionSubtotal * (1 + vatRate / 100)
            : sectionSubtotal;

        return (
            <React.Fragment>
                <View style={styles.invoiceSectionRow}>
                    <Text style={styles.invoiceSectionText}>{sectionTitle}</Text>
                </View>
                {sectionItems.map((item, index) => {
                    const lineSubtotal = item.quantity * item.unitPrice;
                    const lineTotalWithVat = includeVat
                        ? lineSubtotal * (1 + vatRate / 100)
                        : lineSubtotal;

                    return (
                        <View key={item.id} style={styles.tableRow}>
                            <Text style={styles.invoiceItemIdCol}>{startIndex + index}</Text>
                            <Text style={styles.invoiceItemNameCol}>{item.name}</Text>
                            <Text style={styles.invoiceItemQtyCol}>{item.quantity} ед</Text>
                            <Text style={styles.invoiceItemPriceCol}>
                                {formatAmount(item.unitPrice)}
                            </Text>
                            <Text style={styles.invoiceItemSubtotalCol}>
                                {formatAmount(lineSubtotal)} KZT
                            </Text>
                            <Text style={styles.invoiceItemTotalCol}>
                                {formatAmount(lineTotalWithVat)} KZT
                            </Text>
                        </View>
                    );
                })}
                <View style={styles.tableRow}>
                    <Text style={styles.invoiceSubtotalLabelCol}>Итого по разделу «{sectionTitle}»</Text>
                    <Text style={styles.invoiceSubtotalValueCol}>{formatAmount(sectionSubtotal)} KZT</Text>
                    <Text style={styles.invoiceSubtotalValueCol}>{formatAmount(sectionTotalWithVat)} KZT</Text>
                </View>
            </React.Fragment>
        );
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.invoiceHeadingRow}>
                    <View style={styles.invoiceCompanyBlock}>
                        <Image style={styles.logo} src="/aster-logo.png" />
                        <Text>{companyDetails}</Text>
                    </View>
                    <View style={styles.invoiceMetaBlock}>
                        <Text style={styles.invoiceTitle}>ЦЕНОВОЕ ПРЕДЛОЖЕНИЕ</Text>
                        <Text style={styles.invoiceMetaText}>№ {invoiceNumber}</Text>
                        <Text style={styles.invoiceMetaText}>Дата: {invoiceDate}</Text>
                    </View>
                </View>

                <View style={styles.recipientBox}>
                    <Text style={styles.recipientLabel}>Кому:</Text>
                    {recipientLines.map((line, index) => (
                        <Text key={`${line}-${index}`} style={styles.recipientText}>
                            {line}
                        </Text>
                    ))}
                    {recipientDetails.map((line, index) => (
                        <Text key={`${line}-${index}`} style={styles.recipientText}>
                            {line}
                        </Text>
                    ))}
                </View>

                <View style={styles.invoiceInfoTable}>
                    <View style={styles.invoiceInfoRow}>
                        <Text style={styles.invoiceInfoHeaderCell}>Отправитель</Text>
                        <Text style={styles.invoiceInfoHeaderCell}>Контактный номер</Text>
                        <Text style={styles.invoiceInfoHeaderCell}>Заказчик</Text>
                        <Text style={styles.invoiceInfoHeaderCell}>Пункт отправки</Text>
                        <Text style={styles.invoiceInfoHeaderCell}>Пункт доставки</Text>
                        <Text style={[styles.invoiceInfoHeaderCell, { borderRightWidth: 0 }]}>Условия поставки</Text>
                    </View>
                    <View style={[styles.invoiceInfoRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.invoiceInfoValueCell}>JVM Сеул</Text>
                        <Text style={styles.invoiceInfoValueCell}>Официальный представитель Aster Project</Text>
                        <Text style={styles.invoiceInfoValueCell}>{recipientLines[0] ?? recipient}</Text>
                        <Text style={styles.invoiceInfoValueCell}>{originPoint || 'Сеул'}</Text>
                        <Text style={styles.invoiceInfoValueCell}>{deliveryPoint || 'Алматы'}</Text>
                        <Text style={[styles.invoiceInfoValueCell, { borderRightWidth: 0 }]}>{supplyTerms || 'EXW '}</Text>
                    </View>
                </View>

                <View style={styles.table}>
                    <View style={styles.tableRow}>
                        <Text style={[styles.invoiceItemIdCol, styles.tableHeader]}>№</Text>
                        <Text style={[styles.invoiceItemNameCol, styles.tableHeader]}>Наименование</Text>
                        <Text style={[styles.invoiceItemQtyCol, styles.tableHeader]}>Кол-во</Text>
                        <Text style={[styles.invoiceItemPriceCol, styles.tableHeader]}>Цена за ед. (KZT)</Text>
                        <Text style={[styles.invoiceItemSubtotalCol, styles.tableHeader]}>Сумма без НДС</Text>
                        <Text style={[styles.invoiceItemTotalCol, styles.tableHeader]}>Сумма с НДС</Text>
                    </View>
                    {renderInvoiceSection('Товары', productItems, 1)}
                    {renderInvoiceSection('Услуги', serviceItems, productItems.length + 1)}
                </View>

                <View style={styles.summaryBlock}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>SUBTOTAL</Text>
                        <Text>{formatAmount(totalWithoutVat)} KZT</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>НДС {includeVat ? `${vatRate}%` : 'не учитывается'}</Text>
                        <Text>{includeVat ? `${formatAmount(totalVat)} KZT` : '0.00 KZT'}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Всего</Text>
                        <Text>{formatAmount(totalWithVat)} KZT</Text>
                    </View>
                </View>

                <Text style={styles.invoiceTerms}>Условия оплаты: {(prepaymentPercent || '100').trim()}% предоплата</Text>
            </Page>

            <Page size="A4" style={styles.page}>
                <View style={styles.marketingBlock}>
                    <Text style={styles.marketingPageTitle}>Дополнительные услуги</Text>
                    {/* <Text style={styles.marketingIntro}>
                        Для маркетинга. Это наши доп услуги, которые автоматом наши клиенты получают:
                    </Text> */}
                    {marketingServices.map((service, index) => (
                        <View key={service.title} style={styles.marketingItem}>
                            <Text style={styles.marketingItemTitle}>
                                {index + 1}. {service.title}
                            </Text>
                            {service.description ? (
                                <Text style={styles.marketingItemDescription}>{service.description}</Text>
                            ) : null}
                            {service.bullets.map((bullet) => (
                                <Text key={bullet} style={styles.marketingBullet}>
                                    • {bullet}
                                </Text>
                            ))}
                        </View>
                    ))}
                </View>
            </Page>
        </Document>
    );
};

// Главный компонент Dashboard
export default function Dashboard() {
    const { user } = useUser();
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

        fetchProducts();
        fetchExchangeRateUSD();
        fetchCompanyDetails();
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

    const handleDownload = async () => {
        if (!user || filteredProducts.length === 0 || !exchangeRateUSD) return;

        const blob = await pdf(
            <CommercialOfferPDF
                selectedProducts={filteredProducts}
                user={user}
                exchangeRateUSD={exchangeRateUSD}
                companyDetails={companyDetails}
                vatRate={vatRate}
            />
        ).toBlob();

        saveAs(blob, 'Commercial_Offer_Aster_Project.pdf');
    };

    const handleInvoiceDialogOpen = (open: boolean) => {
        setIsInvoiceDialogOpen(open);

        if (open && !invoiceNumber) {
            const generatedNumber = `${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
            setInvoiceNumber(generatedNumber);
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

    const handleInvoiceDownload = async () => {
        if (!user || filteredProducts.length === 0 || !invoiceRecipient.trim() || invoiceItems.length === 0) {
            return;
        }

        const invoiceDate = new Date().toLocaleDateString('ru-RU');
        const blob = await pdf(
            <InvoicePDF
                items={invoiceItems}
                user={user}
                companyDetails={companyDetails}
                recipient={invoiceRecipient}
                director={invoiceDirector}
                address={invoiceAddress}
                phone={invoicePhone}
                originPoint={invoiceOriginPoint}
                deliveryPoint={invoiceDeliveryPoint}
                supplyTerms={invoiceSupplyTerms}
                prepaymentPercent={invoicePrepaymentPercent}
                includeVat={invoiceIncludeVat}
                vatRate={vatRate}
                invoiceNumber={invoiceNumber || `${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`}
                invoiceDate={invoiceDate}
            />
        ).toBlob();

        saveAs(blob, `Invoice_${invoiceNumber || 'draft'}.pdf`);
        setIsInvoiceDialogOpen(false);
    };

    const invoiceSubtotal = invoiceItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const invoiceVatAmount = invoiceIncludeVat ? invoiceSubtotal * vatRate / 100 : 0;
    const invoiceGrandTotal = invoiceSubtotal + invoiceVatAmount;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Панель управления" />
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
                                    disabled={filteredProducts.length === 0 }
                                    className="bg-orange-600 text-white shadow-sm hover:bg-orange-700"
                                >
                                    Ценовое предложение
                                </Button>
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

                        <DialogFooter className="mt-4 shrink-0 border-t bg-background pt-4 sm:justify-end">
                            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => handleInvoiceDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button
                                type="button"
                                className="w-full sm:w-auto"
                                onClick={handleInvoiceDownload}
                                disabled={filteredProducts.length === 0 || !invoiceRecipient.trim()}
                            >
                                Скачать PDF
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
