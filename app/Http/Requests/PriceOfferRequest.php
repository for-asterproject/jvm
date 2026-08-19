<?php

namespace App\Http\Requests;

use App\Models\PriceOffer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PriceOfferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $priceOfferId = $this->route('priceOffer')?->id;

        return [
            'number' => ['nullable', 'string', 'max:50', Rule::unique('price_offers', 'number')->ignore($priceOfferId)],
            'offer_date' => ['nullable', 'date'],
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')],
            'recipient' => ['required', 'string', 'max:1000'],
            'director' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
            'phone' => ['nullable', 'string', 'max:100'],
            'origin_point' => ['nullable', 'string', 'max:255'],
            'delivery_point' => ['nullable', 'string', 'max:255'],
            'supply_terms' => ['nullable', 'string', 'max:255'],
            'prepayment_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'include_vat' => ['nullable', 'boolean'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'exchange_rate_usd' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(PriceOffer::STATUSES)],
            'notes' => ['nullable', 'string', 'max:5000'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'integer', Rule::exists('products', 'id')],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.is_service' => ['nullable', 'boolean'],
            'items.*.quantity' => ['required', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'number.unique' => 'Ценовое предложение с таким номером уже есть в журнале.',
            'recipient.required' => 'Укажите получателя предложения.',
            'items.required' => 'Добавьте хотя бы одну позицию.',
            'items.min' => 'Добавьте хотя бы одну позицию.',
        ];
    }
}
