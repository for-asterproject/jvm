import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import React from 'react';

// Регистрируем шрифт с поддержкой кириллицы
import RobotoRegular from '@/fonts/Roboto-Regular.ttf';

Font.register({
    family: 'Roboto',
    src: RobotoRegular,
});

export interface InvoiceItem {
    id: number;
    name: string;
    is_service: boolean;
    quantity: number;
    unitPrice: number;
}

export interface InvoicePDFProps {
    items: InvoiceItem[];
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
    table: {
        marginVertical: 10,
    },
    tableRow: {
        flexDirection: 'row',
    },
    tableHeader: {
        fontWeight: 'bold',
        backgroundColor: '#f0f0f0',
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
        description:
            'В рамках долгосрочного партнерства организуется выезд 2-х ведущих специалистов вашей организации (клинического фармаколога / главного врача / руководителя проекта) в Южную Корею:',
        bullets: [
            'Посещение завода JVM: Ознакомление с процессом производства и контроля качества.',
            'Clinical Tour: 3х дневный визит в ведущие клиники Сеула, где системы JVM работают в промышленном масштабе.',
            'Цель: Обмен опытом по оптимизации логистики внутри больницы и получению максимального экономического эффекта от внедрения.',
        ],
    },
];

export const formatAmount = (value: number) => {
    const normalizedValue = Number.isFinite(value) ? value : 0;

    return normalizedValue
        .toLocaleString('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
        .replace(/[\u00A0\u202F]/g, ' ');
};

export const InvoicePDF: React.FC<InvoicePDFProps> = ({
    items,
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
    const totalVat = includeVat ? (totalWithoutVat * vatRate) / 100 : 0;
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
        const sectionTotalWithVat = includeVat ? sectionSubtotal * (1 + vatRate / 100) : sectionSubtotal;

        return (
            <React.Fragment>
                <View style={styles.invoiceSectionRow}>
                    <Text style={styles.invoiceSectionText}>{sectionTitle}</Text>
                </View>
                {sectionItems.map((item, index) => {
                    const lineSubtotal = item.quantity * item.unitPrice;
                    const lineTotalWithVat = includeVat ? lineSubtotal * (1 + vatRate / 100) : lineSubtotal;

                    return (
                        <View key={item.id} style={styles.tableRow}>
                            <Text style={styles.invoiceItemIdCol}>{startIndex + index}</Text>
                            <Text style={styles.invoiceItemNameCol}>{item.name}</Text>
                            <Text style={styles.invoiceItemQtyCol}>{item.quantity} ед</Text>
                            <Text style={styles.invoiceItemPriceCol}>{formatAmount(item.unitPrice)}</Text>
                            <Text style={styles.invoiceItemSubtotalCol}>{formatAmount(lineSubtotal)} KZT</Text>
                            <Text style={styles.invoiceItemTotalCol}>{formatAmount(lineTotalWithVat)} KZT</Text>
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
                    {marketingServices.map((service, index) => (
                        <View key={service.title} style={styles.marketingItem}>
                            <Text style={styles.marketingItemTitle}>
                                {index + 1}. {service.title}
                            </Text>
                            {service.description ? <Text style={styles.marketingItemDescription}>{service.description}</Text> : null}
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

/**
 * Сборка PDF ценового предложения в blob — используется и на прайс-листе, и в журнале.
 */
export const buildPriceOfferPdfBlob = (props: InvoicePDFProps) => pdf(<InvoicePDF {...props} />).toBlob();
