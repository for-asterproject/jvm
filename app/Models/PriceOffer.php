<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PriceOffer extends Model
{
    use HasFactory;

    public const STATUSES = ['draft', 'sent', 'accepted', 'rejected'];

    protected $fillable = [
        'number',
        'offer_date',
        'client_id',
        'recipient',
        'director',
        'address',
        'phone',
        'origin_point',
        'delivery_point',
        'supply_terms',
        'prepayment_percent',
        'include_vat',
        'vat_rate',
        'exchange_rate_usd',
        'subtotal',
        'vat_amount',
        'total',
        'status',
        'notes',
        'copied_from_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'offer_date' => 'date:Y-m-d',
            'include_vat' => 'boolean',
            'vat_rate' => 'decimal:2',
            'exchange_rate_usd' => 'decimal:4',
            'subtotal' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PriceOfferItem::class)->orderBy('sort_order');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function copiedFrom(): BelongsTo
    {
        return $this->belongsTo(self::class, 'copied_from_id');
    }

    public function copies(): HasMany
    {
        return $this->hasMany(self::class, 'copied_from_id');
    }

    /**
     * Следующий свободный номер предложения в формате ГОД-000001.
     */
    public static function nextNumber(): string
    {
        $year = now()->year;
        $lastNumber = static::query()
            ->where('number', 'like', $year.'-%')
            ->orderByDesc('id')
            ->value('number');

        $sequence = $lastNumber
            ? ((int) substr($lastNumber, strlen((string) $year) + 1)) + 1
            : 1;

        do {
            $candidate = sprintf('%d-%06d', $year, max($sequence, 1));
            $sequence++;
        } while (static::where('number', $candidate)->exists());

        return $candidate;
    }

    /**
     * Пересчёт итогов по сохранённым позициям.
     */
    public function recalculateTotals(): void
    {
        $subtotal = $this->items()->get()->reduce(
            fn (float $sum, PriceOfferItem $item) => $sum + (float) $item->quantity * (float) $item->unit_price,
            0.0,
        );

        $vatAmount = $this->include_vat
            ? round($subtotal * (float) $this->vat_rate / 100, 2)
            : 0.0;

        $this->forceFill([
            'subtotal' => round($subtotal, 2),
            'vat_amount' => $vatAmount,
            'total' => round($subtotal + $vatAmount, 2),
        ])->save();
    }
}
