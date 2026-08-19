<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\PriceOffer;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PriceOfferTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_save_a_formed_price_list_to_the_journal(): void
    {
        $employee = $this->userWithRole('Сотрудник');
        $client = $this->client('Городская больница №1');
        $product = $this->product('Аппарат JVM');

        $response = $this->actingAs($employee)->postJson('/price-offers', $this->offerPayload([
            'client_id' => $client->id,
            'items' => [
                ['product_id' => $product->id, 'name' => $product->name, 'is_service' => false, 'quantity' => 2, 'unit_price' => 1000],
                ['product_id' => null, 'name' => 'Монтаж', 'is_service' => true, 'quantity' => 1, 'unit_price' => 500],
            ],
        ]));

        $response->assertCreated();

        $offer = PriceOffer::with('items')->firstOrFail();

        $this->assertSame(now()->year.'-000001', $offer->number);
        $this->assertSame($employee->id, $offer->created_by);
        $this->assertSame($client->id, $offer->client_id);
        $this->assertCount(2, $offer->items);

        // 2 × 1000 + 1 × 500 = 2500, НДС 12% = 300
        $this->assertSame('2500.00', $offer->subtotal);
        $this->assertSame('300.00', $offer->vat_amount);
        $this->assertSame('2800.00', $offer->total);
    }

    public function test_offer_totals_ignore_vat_when_it_is_switched_off(): void
    {
        $employee = $this->userWithRole('Сотрудник');

        $this->actingAs($employee)
            ->postJson('/price-offers', $this->offerPayload(['include_vat' => false]))
            ->assertCreated();

        $offer = PriceOffer::firstOrFail();

        $this->assertSame('1000.00', $offer->subtotal);
        $this->assertSame('0.00', $offer->vat_amount);
        $this->assertSame('1000.00', $offer->total);
    }

    public function test_offer_number_must_stay_unique(): void
    {
        $employee = $this->userWithRole('Сотрудник');

        $this->actingAs($employee)->postJson('/price-offers', $this->offerPayload(['number' => '2026-000777']))->assertCreated();
        $this->actingAs($employee)
            ->postJson('/price-offers', $this->offerPayload(['number' => '2026-000777']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('number');
    }

    public function test_offer_can_be_copied_for_another_client(): void
    {
        $employee = $this->userWithRole('Сотрудник');
        $firstClient = $this->client('Первый клиент');
        $secondClient = $this->client('Второй клиент', '222222222222');

        $this->actingAs($employee)->postJson('/price-offers', $this->offerPayload([
            'client_id' => $firstClient->id,
            'items' => [
                ['product_id' => null, 'name' => 'Аппарат JVM', 'is_service' => false, 'quantity' => 3, 'unit_price' => 700],
            ],
        ]))->assertCreated();

        $source = PriceOffer::firstOrFail();

        $this->actingAs($employee)->post("/price-offers/{$source->id}/duplicate", [
            'client_id' => $secondClient->id,
            'recipient' => $secondClient->company_name,
            'director' => 'Новый директор',
            'phone' => '+7 700 111 22 33',
        ])->assertRedirect();

        $copy = PriceOffer::with('items')->where('id', '!=', $source->id)->firstOrFail();

        $this->assertSame($source->id, $copy->copied_from_id);
        $this->assertSame($secondClient->id, $copy->client_id);
        $this->assertSame('Второй клиент', $copy->recipient);
        $this->assertSame('Новый директор', $copy->director);
        $this->assertNotSame($source->number, $copy->number);

        // Позиции и итоги переносятся без изменений
        $this->assertCount(1, $copy->items);
        $this->assertSame('Аппарат JVM', $copy->items->first()->name);
        $this->assertSame('2100.00', $copy->subtotal);
        $this->assertSame($source->total, $copy->total);

        // Исходное предложение остаётся нетронутым
        $this->assertSame($firstClient->id, $source->fresh()->client_id);
    }

    public function test_journal_lists_saved_offers(): void
    {
        $employee = $this->userWithRole('Сотрудник');

        $this->actingAs($employee)->postJson('/price-offers', $this->offerPayload())->assertCreated();

        $this->actingAs($employee)
            ->get('/price-offers')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('crm/price-offers')
                ->has('offers', 1)
                ->has('clients'));
    }

    public function test_consultant_cannot_reach_the_journal(): void
    {
        $consultant = $this->userWithRole('Консультант');

        $this->actingAs($consultant)->get('/price-offers')->assertForbidden();
        $this->actingAs($consultant)->postJson('/price-offers', $this->offerPayload())->assertForbidden();
    }

    public function test_offer_requires_recipient_and_items(): void
    {
        $employee = $this->userWithRole('Сотрудник');

        $this->actingAs($employee)
            ->postJson('/price-offers', ['recipient' => '', 'items' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['recipient', 'items']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function offerPayload(array $overrides = []): array
    {
        return [
            'offer_date' => '2026-08-19',
            'recipient' => 'ПХВ Центр перинатологии',
            'director' => 'Иванов И.И.',
            'address' => 'Алматы',
            'phone' => '+7 700 000 00 00',
            'origin_point' => 'Сеул',
            'delivery_point' => 'Алматы',
            'supply_terms' => 'EXW',
            'prepayment_percent' => 100,
            'include_vat' => true,
            'vat_rate' => 12,
            'exchange_rate_usd' => 520.5,
            'status' => 'draft',
            'items' => [
                ['product_id' => null, 'name' => 'Аппарат JVM', 'is_service' => false, 'quantity' => 1, 'unit_price' => 1000],
            ],
            ...$overrides,
        ];
    }

    private function client(string $companyName, string $bin = '111111111111'): Client
    {
        return Client::create([
            'company_name' => $companyName,
            'division' => 'jvm',
            'bin' => $bin,
            'contact_name' => 'Контакт',
            'phone' => '+7 700 999 88 77',
            'address' => 'Алматы, ул. Тестовая 1',
            'status' => 'active',
        ]);
    }

    private function product(string $name): Product
    {
        return Product::create([
            'name' => $name,
            'factory_price' => 1000,
            'markup_percentage' => 10,
            'agent_bonus' => 5,
        ]);
    }

    private function userWithRole(string $roleName): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::firstOrCreate(['name' => $roleName]));

        return $user->load('roles');
    }
}
