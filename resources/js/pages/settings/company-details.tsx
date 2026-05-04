import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/bookepinglayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Реквизиты компании',
        href: '/company-details',
    },
];

interface CompanyDetailsForm {
    company_name: string;
    legal_address: string;
    email: string;
    bin: string;
    bank_name: string;
    bank_bik: string;
    iban_kzt: string;
    kbe: string;
    vat_rate: string;
}

const initialForm: CompanyDetailsForm = {
    company_name: '',
    legal_address: '',
    email: '',
    bin: '',
    bank_name: '',
    bank_bik: '',
    iban_kzt: '',
    kbe: '',
    vat_rate: '12',
};

export default function CompanyDetailsPage() {
    const [form, setForm] = useState<CompanyDetailsForm>(initialForm);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        axios
            .get('/company-details/current')
            .then((response) => {
                setForm({
                    company_name: response.data.company_name,
                    legal_address: response.data.legal_address,
                    email: response.data.email,
                    bin: response.data.bin,
                    bank_name: response.data.bank_name,
                    bank_bik: response.data.bank_bik,
                    iban_kzt: response.data.iban_kzt,
                    kbe: response.data.kbe,
                    vat_rate: String(response.data.vat_rate ?? '12'),
                });
            })
            .catch((loadError) => {
                console.error('Ошибка при загрузке реквизитов:', loadError);
                setError('Не удалось загрузить реквизиты компании.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const handleChange = (field: keyof CompanyDetailsForm, value: string) => {
        setForm((currentForm) => ({ ...currentForm, [field]: value }));
        setError(null);
        setMessage(null);
    };

    const handleSubmit = () => {
        setError(null);
        setMessage(null);

        axios
            .put('/company-details', form)
            .then((response) => {
                setForm(response.data.companyDetails);
                setMessage(response.data.message);
            })
            .catch((saveError) => {
                console.error('Ошибка при сохранении реквизитов:', saveError);
                setError(saveError.response?.data?.message ?? 'Не удалось сохранить реквизиты компании.');
            });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Реквизиты компании" />
            <SettingsLayout>
                <div className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold">Реквизиты компании</h2>
                        <p className="text-sm text-muted-foreground">
                            Здесь можно вводить и редактировать реквизиты, которые используются в документах.
                        </p>
                    </div>

                    {loading && <p>Загрузка реквизитов...</p>}
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {message && <p className="text-sm text-green-600">{message}</p>}

                    {!loading && (
                        <div className="space-y-4">
                            <Input
                                value={form.company_name}
                                onChange={(event) => handleChange('company_name', event.target.value)}
                                placeholder="Наименование компании"
                            />
                            <textarea
                                value={form.legal_address}
                                onChange={(event) => handleChange('legal_address', event.target.value)}
                                placeholder="Юридический адрес"
                                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                            />
                            <Input
                                value={form.email}
                                onChange={(event) => handleChange('email', event.target.value)}
                                placeholder="Электронная почта"
                            />
                            <Input
                                value={form.bin}
                                onChange={(event) => handleChange('bin', event.target.value)}
                                placeholder="БИН"
                            />
                            <Input
                                value={form.bank_name}
                                onChange={(event) => handleChange('bank_name', event.target.value)}
                                placeholder="Наименование банка"
                            />
                            <Input
                                value={form.bank_bik}
                                onChange={(event) => handleChange('bank_bik', event.target.value)}
                                placeholder="БСК/БИК (SWIFT)"
                            />
                            <Input
                                value={form.iban_kzt}
                                onChange={(event) => handleChange('iban_kzt', event.target.value)}
                                placeholder="ИИК (KZT)"
                            />
                            <Input
                                value={form.kbe}
                                onChange={(event) => handleChange('kbe', event.target.value)}
                                placeholder="КБЕ"
                            />
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={form.vat_rate}
                                onChange={(event) => handleChange('vat_rate', event.target.value)}
                                placeholder="Ставка НДС (%)"
                            />
                            <Button type="button" onClick={handleSubmit}>
                                Сохранить реквизиты
                            </Button>
                        </div>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}