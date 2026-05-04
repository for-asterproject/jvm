<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('company_details', function (Blueprint $table) {
            $table->id();
            $table->string('company_name');
            $table->string('legal_address', 1000);
            $table->string('email');
            $table->string('bin', 20);
            $table->string('bank_name');
            $table->string('bank_bik', 50);
            $table->string('iban_kzt', 34);
            $table->string('kbe', 10);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('company_details');
    }
};