<?php

namespace App\Http\Controllers;

use App\Http\Requests\PriceOfferRequest;
use App\Models\Client;
use App\Models\PriceOffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PriceOfferController extends Controller
{
    /**
     * Журнал ценовых предложений.
     */
    public function index(): Response
    {
        $this->authorize('viewAny', PriceOffer::class);

        return Inertia::render('crm/price-offers', [
            'offers' => PriceOffer::query()
                ->with(['items', 'client:id,company_name,division', 'creator:id,name', 'copiedFrom:id,number'])
                ->latest('id')
                ->get(),
            'clients' => $this->clientOptions(),
        ]);
    }

    /**
     * Данные для формы предложения на странице «Прайс Лист».
     */
    public function formOptions(): JsonResponse
    {
        $this->authorize('create', PriceOffer::class);

        return response()->json([
            'next_number' => PriceOffer::nextNumber(),
            'clients' => $this->clientOptions(),
        ]);
    }

    /**
     * Сохранение сформированного прайса в журнал.
     */
    public function store(PriceOfferRequest $request): JsonResponse|RedirectResponse
    {
        $this->authorize('create', PriceOffer::class);

        $data = $request->validated();

        $priceOffer = DB::transaction(function () use ($data, $request) {
            $priceOffer = PriceOffer::create([
                ...$this->offerAttributes($data),
                'number' => ($data['number'] ?? null) ?: PriceOffer::nextNumber(),
                'created_by' => $request->user()->id,
            ]);

            $this->syncItems($priceOffer, $data['items']);

            return $priceOffer;
        });

        return $this->respond($request, $priceOffer, 'Ценовое предложение сохранено в журнал.', 201);
    }

    /**
     * Редактирование сохранённого предложения.
     */
    public function update(PriceOfferRequest $request, PriceOffer $priceOffer): JsonResponse|RedirectResponse
    {
        $this->authorize('update', $priceOffer);

        $data = $request->validated();

        DB::transaction(function () use ($data, $priceOffer) {
            $priceOffer->update([
                ...$this->offerAttributes($data, $priceOffer),
                'number' => ($data['number'] ?? null) ?: $priceOffer->number,
            ]);

            $this->syncItems($priceOffer, $data['items']);
        });

        return $this->respond($request, $priceOffer, 'Ценовое предложение обновлено.');
    }

    /**
     * Копирование предложения для другого клиента.
     */
    public function duplicate(Request $request, PriceOffer $priceOffer): JsonResponse|RedirectResponse
    {
        $this->authorize('create', PriceOffer::class);

        $data = $request->validate([
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')],
            'recipient' => ['required', 'string', 'max:1000'],
            'director' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
            'phone' => ['nullable', 'string', 'max:100'],
            'number' => ['nullable', 'string', 'max:50', Rule::unique('price_offers', 'number')],
        ], [
            'number.unique' => 'Ценовое предложение с таким номером уже есть в журнале.',
            'recipient.required' => 'Укажите получателя нового предложения.',
        ]);

        $copy = DB::transaction(function () use ($data, $priceOffer, $request) {
            $copy = PriceOffer::create([
                ...$priceOffer->only([
                    'origin_point',
                    'delivery_point',
                    'supply_terms',
                    'prepayment_percent',
                    'include_vat',
                    'vat_rate',
                    'exchange_rate_usd',
                    'notes',
                ]),
                'number' => ($data['number'] ?? null) ?: PriceOffer::nextNumber(),
                'offer_date' => now()->toDateString(),
                'client_id' => $data['client_id'] ?? null,
                'recipient' => $data['recipient'],
                'director' => $data['director'] ?? null,
                'address' => $data['address'] ?? null,
                'phone' => $data['phone'] ?? null,
                'status' => 'draft',
                'copied_from_id' => $priceOffer->id,
                'created_by' => $request->user()->id,
            ]);

            $this->syncItems($copy, $priceOffer->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'name' => $item->name,
                'is_service' => $item->is_service,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
            ])->all());

            return $copy;
        });

        return $this->respond($request, $copy, "Создана копия предложения № {$copy->number}.", 201);
    }

    public function destroy(Request $request, PriceOffer $priceOffer): JsonResponse|RedirectResponse
    {
        $this->authorize('delete', $priceOffer);

        $priceOffer->delete();

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Ценовое предложение удалено.']);
        }

        return back()->with('success', 'Ценовое предложение удалено.');
    }

    /**
     * Общие атрибуты предложения из проверенных данных формы.
     *
     * Поля, которых нет в запросе, при редактировании сохраняют текущее значение —
     * форма журнала не присылает, например, курс USD, зафиксированный при выпуске.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function offerAttributes(array $data, ?PriceOffer $current = null): array
    {
        $value = fn (string $key, mixed $default) => array_key_exists($key, $data)
            ? $data[$key]
            : ($current?->getAttribute($key) ?? $default);

        return [
            'offer_date' => $value('offer_date', now()->toDateString()),
            'client_id' => $value('client_id', null),
            'recipient' => $data['recipient'],
            'director' => $value('director', null),
            'address' => $value('address', null),
            'phone' => $value('phone', null),
            'origin_point' => $value('origin_point', null),
            'delivery_point' => $value('delivery_point', null),
            'supply_terms' => $value('supply_terms', null),
            'prepayment_percent' => $value('prepayment_percent', 100),
            'include_vat' => $value('include_vat', true),
            'vat_rate' => $value('vat_rate', 0),
            'exchange_rate_usd' => $value('exchange_rate_usd', null),
            'status' => $value('status', 'draft'),
            'notes' => $value('notes', null),
        ];
    }

    /**
     * Перезапись позиций предложения и пересчёт итогов.
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    private function syncItems(PriceOffer $priceOffer, array $items): void
    {
        $priceOffer->items()->delete();

        foreach (array_values($items) as $index => $item) {
            $priceOffer->items()->create([
                'product_id' => $item['product_id'] ?? null,
                'name' => $item['name'],
                'is_service' => $item['is_service'] ?? false,
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'sort_order' => $index,
            ]);
        }

        $priceOffer->load('items');
        $priceOffer->recalculateTotals();
    }

    private function respond(Request $request, PriceOffer $priceOffer, string $message, int $status = 200): JsonResponse|RedirectResponse
    {
        if ($request->wantsJson()) {
            return response()->json([
                'message' => $message,
                'offer' => $priceOffer->fresh()->load(['items', 'client:id,company_name,division', 'creator:id,name']),
            ], $status);
        }

        return back()->with('success', $message);
    }

    /**
     * Список клиентов для выбора получателя.
     */
    private function clientOptions()
    {
        return Client::query()
            ->orderBy('company_name')
            ->get(['id', 'company_name', 'division', 'bin', 'contact_name', 'position', 'phone', 'email', 'address', 'status']);
    }
}
