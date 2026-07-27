<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('manager_id')
                ->nullable()
                ->after('id')
                ->constrained('users')
                ->nullOnDelete();
        });

        foreach (['Администратор', 'Бухгалтер', 'Руководитель', 'Сотрудник', 'Консультант'] as $roleName) {
            if (! DB::table('roles')->where('name', $roleName)->exists()) {
                DB::table('roles')->insert([
                    'name' => $roleName,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        if (DB::table('users')->count() === 1) {
            $administratorRoleId = DB::table('roles')->where('name', 'Администратор')->value('id');
            $userId = DB::table('users')->value('id');

            if (! DB::table('role_user')->where('user_id', $userId)->where('role_id', $administratorRoleId)->exists()) {
                DB::table('role_user')->insert([
                    'user_id' => $userId,
                    'role_id' => $administratorRoleId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('manager_id');
        });
    }
};
