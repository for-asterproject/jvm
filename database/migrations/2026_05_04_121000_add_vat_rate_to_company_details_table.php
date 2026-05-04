<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('company_details', function (Blueprint $table) {
            $table->decimal('vat_rate', 5, 2)->default(12.00)->after('kbe');
        });
    }

    public function down()
    {
        Schema::table('company_details', function (Blueprint $table) {
            $table->dropColumn('vat_rate');
        });
    }
};