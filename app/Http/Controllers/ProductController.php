<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CompanyDetail;
use App\Models\Product;
use App\Imports\ProductsImport;
use App\Models\ExchangeRate;
use Maatwebsite\Excel\Facades\Excel;

class ProductController extends Controller
{
     /**
     * Получение всех продуктов.
     */
    public function index()
    {
        // Получаем все продукты из базы
        $products = Product::all();

        // Возвращаем данные в виде JSON
        return response()->json($products);
    }
    /**
     * Добавление новой продукции.
     */
    public function store(Request $request)
    {
        // Валидация входных данных
        $validatedData = $request->validate([
            'name' => 'required|string|max:255',
            'factory_price' => 'required|numeric|min:0',
            'markup_percentage' => 'required|numeric|min:0',
            'agent_bonus' => 'required|numeric|min:0',
            'is_service' => 'nullable|boolean',
        ]);

        $validatedData['is_service'] = (bool) ($validatedData['is_service'] ?? false);

        // Создание продукции
        $product = Product::create($validatedData);

        return response()->json([
            'message' => 'Продукция успешно добавлена!',
            'product' => $product,
        ], 201);
    }

    /**
     * Изменение данных продукции.
     */
    public function update(Request $request, $id)
    {
        // Поиск продукции по ID
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'message' => 'Продукция не найдена.',
            ], 404);
        }

        // Валидация входных данных
        $validatedData = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'factory_price' => 'sometimes|required|numeric|min:0',
            'markup_percentage' => 'sometimes|required|numeric|min:0',
            'agent_bonus' => 'sometimes|required|numeric|min:0',
            'is_service' => 'sometimes|boolean',
        ]);

        // Обновление данных продукции
        $product->update($validatedData);

        return response()->json([
            'message' => 'Продукция успешно обновлена!',
            'product' => $product,
        ]);
    }

    /**
     * Удаление продукции.
     */
    public function destroy($id)
    {
        // Поиск продукции по ID
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'message' => 'Продукция не найдена.',
            ], 404);
        }

        // Удаление продукции
        $product->delete();

        return response()->json([
            'message' => 'Продукция успешно удалена!',
        ]);
    }

    /**
     * Загрузка Excel-файла и импорт продуктов.
     */
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv', // Ограничение на тип файла
        ]);

        try {
            Excel::import(new ProductsImport, $request->file('file'));

            return response()->json(['message' => 'Продукты успешно импортированы!'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Ошибка при импорте: ' . $e->getMessage()], 500);
        }
    }

     /**
     * Вывод продукции и цен.
     */
    public function price()
    {
        $vatRate = CompanyDetail::query()->value('vat_rate') ?? 0;

        // Получаем актуальные курсы валют
        $baseCurrencyRate = ExchangeRate::where('currency_code', 'USD')
            ->orderBy('date', 'desc')
            ->value('final_rate') ?? 1;


        // Получаем список всех продуктов
        $products = Product::all()->map(function ($product) use ($baseCurrencyRate, $vatRate) {
            $priceBaseCurrency = round($product->factory_price
                + ($product->factory_price * $product->markup_percentage / 100)
                + ($product->factory_price * $product->agent_bonus / 100),2);

            $vatAmountBaseCurrency = round($priceBaseCurrency * $vatRate / 100, 2);
            $priceWithVatBaseCurrency = round($priceBaseCurrency + $vatAmountBaseCurrency, 2);

            $priceForeignCurrency = round($priceBaseCurrency *  $baseCurrencyRate,2);
            $vatAmountForeignCurrency = round($vatAmountBaseCurrency * $baseCurrencyRate, 2);
            $priceWithVatForeignCurrency = round($priceWithVatBaseCurrency * $baseCurrencyRate, 2);

            return [
                'id' => $product->id,
                'name' => $product->name,
                'is_service' => (bool) $product->is_service,
                'vat_rate' => round($vatRate, 2),
                'price_USD_currency' => round($priceBaseCurrency, 2),
                'vat_amount_USD_currency' => round($vatAmountBaseCurrency, 2),
                'price_with_vat_USD_currency' => round($priceWithVatBaseCurrency, 2),
                'price_KZT_currency' => round($priceForeignCurrency, 2),
                'vat_amount_KZT_currency' => round($vatAmountForeignCurrency, 2),
                'price_with_vat_KZT_currency' => round($priceWithVatForeignCurrency, 2),
            ];
        });

        return response()->json($products);
    }
}
