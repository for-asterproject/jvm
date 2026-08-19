<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_offers', function (Blueprint $table) {
            $table->id();
            $table->string('number', 50)->unique();
            $table->date('offer_date');
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->text('recipient');
            $table->string('director')->nullable();
            $table->string('address', 1000)->nullable();
            $table->string('phone', 100)->nullable();
            $table->string('origin_point')->nullable();
            $table->string('delivery_point')->nullable();
            $table->string('supply_terms')->nullable();
            $table->unsignedTinyInteger('prepayment_percent')->default(100);
            $table->boolean('include_vat')->default(true);
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->decimal('exchange_rate_usd', 15, 4)->nullable();
            $table->decimal('subtotal', 18, 2)->default(0);
            $table->decimal('vat_amount', 18, 2)->default(0);
            $table->decimal('total', 18, 2)->default(0);
            $table->string('status', 20)->default('draft')->index();
            $table->text('notes')->nullable();
            $table->foreignId('copied_from_id')->nullable()->constrained('price_offers')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('price_offer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('price_offer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('name');
            $table->boolean('is_service')->default(false);
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 18, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_offer_items');
        Schema::dropIfExists('price_offers');
    }
};
