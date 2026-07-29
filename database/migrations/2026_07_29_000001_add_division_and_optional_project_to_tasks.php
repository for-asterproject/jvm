<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('division', 10)->nullable()->after('project_id')->index();
        });

        DB::table('tasks')
            ->select(['id', 'project_id'])
            ->orderBy('id')
            ->chunkById(200, function ($tasks) {
                $divisions = DB::table('projects')
                    ->whereIn('id', $tasks->pluck('project_id')->filter())
                    ->pluck('division', 'id');

                foreach ($tasks as $task) {
                    DB::table('tasks')
                        ->where('id', $task->id)
                        ->update(['division' => $divisions[$task->project_id] ?? null]);
                }
            });

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->change();
            $table->string('division', 10)->nullable(false)->change();
            $table->foreign('project_id')->references('id')->on('projects')->nullOnDelete();
        });
    }

    public function down(): void
    {
        DB::table('tasks')->whereNull('project_id')->delete();

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
            $table->dropIndex(['division']);
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable(false)->change();
            $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
            $table->dropColumn('division');
        });
    }
};
