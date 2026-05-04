import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef, GridRowEditStopReasons } from '@mui/x-data-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { BreadcrumbItem } from '@/types';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/bookepinglayout';
import { Head } from '@inertiajs/react';
import '@/pages/css/all.css'
import ImportProducts from '@/components/productsimport';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Управление продукцией',
        href: '/productsmanagment',
    },
];

interface Product {
    id: number;
    name: string;
    factory_price: number;
    markup_percentage: number;
    agent_bonus: number;
    is_service: boolean;
}

const emptyProduct: Product = {
    id: 0,
    name: '',
    factory_price: 0,
    markup_percentage: 0,
    agent_bonus: 0,
    is_service: false,
};

export default function ProductsManagement() {
    const [products, setProducts] = useState<Product[]>([]);
    const [newProduct, setNewProduct] = useState<Product>(emptyProduct);

    const parseNumericInput = (value: string) => {
        const parsedValue = Number.parseFloat(value);

        return Number.isFinite(parsedValue) ? parsedValue : 0;
    };

    const getAllproducts = () => {
        axios
            .get('/products')
            .then((response) => setProducts(response.data))
            .catch((error) => console.error('Ошибка при загрузке продуктов:', error));
    };

    useEffect(() => {
        getAllproducts();
    }, []);

    const addProduct = () => {
        if (!newProduct.name.trim() || newProduct.factory_price <= 0) {
            alert('Заполните название и цену для новой позиции.');
            return;
        }

        axios
            .post('/products', newProduct)
            .then((response) => {
                alert(response.data.message);
                getAllproducts();
                setNewProduct(emptyProduct);
            })
            .catch((error) => console.error('Ошибка при добавлении продукта:', error));
    };

    const deleteProduct = (id: number) => {
        axios
            .delete(`/products/${id}`)
            .then(() => {
                setProducts((prevProducts) => prevProducts.filter((product) => product.id !== id));
            })
            .catch((error) => console.error('Ошибка при удалении продукта:', error));
    };

    const updateProduct = (updatedProduct: Product) => {
        axios
            .put(`/products/${updatedProduct.id}`, updatedProduct)
            .then(() => {
                setProducts((prevProducts) =>
                    prevProducts.map((product) =>
                        product.id === updatedProduct.id ? updatedProduct : product
                    )
                );
            })
            .catch((error) => console.error('Ошибка при редактировании продукта:', error));
    };

    const productColumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70 },
        {
            field: 'is_service',
            headerName: 'Тип',
            width: 120,
            type: 'boolean',
            editable: true,
            renderCell: (params) => (params.value ? 'Услуга' : 'Товар'),
        },
        { field: 'name', headerName: 'Наименование', width: 260, editable: true },
        { field: 'factory_price', headerName: 'Цена завода', type: 'number', width: 150, editable: true },
        { field: 'markup_percentage', headerName: 'Наценка (%)', type: 'number', width: 150, editable: true },
        { field: 'agent_bonus', headerName: 'Бонус агенту', type: 'number', width: 150, editable: true },
        {
            field: 'actions',
            headerName: 'Действия',
            width: 150,
            renderCell: (params) => (
                <Button
                    style={{ backgroundColor: 'red', color: 'white' }}
                    onClick={() => deleteProduct(params.id as number)}
                >
                    Удалить
                </Button>
            ),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
        <Head title="Управление продукцией" />
        <SettingsLayout>
            <div className="space-y-6">
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Управление продукцией</h2>
                    <p className="text-sm text-muted-foreground">
                        Добавляйте товары и услуги отдельно. Для услуг используйте отметку «Услуга», чтобы запись была понятна в списке и расчётах.
                    </p>
                </div>

                <div className="rounded-xl border p-4 sm:p-5">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Тип позиции</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant={newProduct.is_service ? 'outline' : 'default'}
                                    onClick={() => setNewProduct({ ...newProduct, is_service: false })}
                                >
                                    Товар
                                </Button>
                                <Button
                                    type="button"
                                    variant={newProduct.is_service ? 'default' : 'outline'}
                                    onClick={() => setNewProduct({ ...newProduct, is_service: true })}
                                >
                                    Услуга
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="product-name">Наименование</Label>
                                <Input
                                    id="product-name"
                                    type="text"
                                    placeholder={newProduct.is_service ? 'Например, IT-интеграция и обучение' : 'Например, JV-12DEN30'}
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="product-price">Цена / себестоимость</Label>
                                <Input
                                    id="product-price"
                                    type="number"
                                    placeholder="0"
                                    value={newProduct.factory_price}
                                    onChange={(e) => setNewProduct({ ...newProduct, factory_price: parseNumericInput(e.target.value) })}
                                    step="0.01"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="product-markup">Наценка (%)</Label>
                                <Input
                                    id="product-markup"
                                    type="number"
                                    placeholder="0"
                                    value={newProduct.markup_percentage}
                                    onChange={(e) => setNewProduct({ ...newProduct, markup_percentage: parseNumericInput(e.target.value) })}
                                    step="0.01"
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_auto] md:items-end">
                            <div className="space-y-2">
                                <Label htmlFor="product-agent-bonus">Бонус агенту (%)</Label>
                                <Input
                                    id="product-agent-bonus"
                                    type="number"
                                    placeholder="0"
                                    value={newProduct.agent_bonus}
                                    onChange={(e) => setNewProduct({ ...newProduct, agent_bonus: parseNumericInput(e.target.value) })}
                                    step="0.01"
                                />
                            </div>
                            <Button type="button" onClick={addProduct} className="md:w-fit">
                                {newProduct.is_service ? 'Добавить услугу' : 'Добавить товар'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div>
                    <ImportProducts/>
                </div>
                <div className="dataGrid-container">
                    <DataGrid
                        rows={products}
                        columns={productColumns}
                        pageSizeOptions={[25, 50, 100]}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 25, page: 0 } },
                        }}
                        pagination
                        processRowUpdate={(updatedRow) => {
                            updateProduct(updatedRow as Product);
                            return updatedRow;
                        }}
                    />
                </div>
            </div>
        </SettingsLayout>
    </AppLayout>
    );
}
