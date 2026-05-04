<?php

namespace App\Imports;

use App\Models\Product;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class ProductsImport implements ToModel, WithHeadingRow
{
    /**
     * Преобразуем каждую строку Excel в модель Product.
     */
    public function model(array $row)
    {
        return new Product([
            'name' => $row['name'], // Столбец "name" в Excel
            'factory_price' => $row['factory_price_usd'], // Столбец "factory_price_usd"
            'markup_percentage' => $row['markup_percentage'], // Столбец "markup_percentage"
            'agent_bonus' => $row['agent_bonus'], // Столбец "agent_bonus"
            'is_service' => filter_var($row['is_service'] ?? false, FILTER_VALIDATE_BOOLEAN), // Опциональный столбец "is_service"
        ]);
    }
}
