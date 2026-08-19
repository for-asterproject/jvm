<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriceOfferItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'price_offer_id',
        'product_id',
        'name',
        'is_service',
        'quantity',
        'unit_price',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_service' => 'boolean',
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
        ];
    }

    public function priceOffer(): BelongsTo
    {
        return $this->belongsTo(PriceOffer::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
