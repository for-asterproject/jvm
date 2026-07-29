<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('task_user', function (Blueprint $table) {
            $table->string('status', 30)->default('planned')->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
        });

        DB::table('tasks')
            ->select(['id', 'status', 'updated_at'])
            ->orderBy('id')
            ->chunkById(500, function ($tasks): void {
                foreach ($tasks as $task) {
                    $status = in_array($task->status, [
                        'in_progress',
                        'review',
                        'needs_revision',
                        'done',
                    ], true) ? $task->status : 'planned';

                    DB::table('task_user')
                        ->where('task_id', $task->id)
                        ->update([
                            'status' => $status,
                            'started_at' => $status !== 'planned' ? $task->updated_at : null,
                            'submitted_at' => in_array($status, ['review', 'needs_revision', 'done'], true)
                                ? $task->updated_at
                                : null,
                            'completed_at' => $status === 'done' ? $task->updated_at : null,
                        ]);
                }
            });

        Schema::create('task_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_assignment_id')->constrained('task_user')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->string('status', 30)->default('pending')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_comment')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['task_assignment_id', 'created_at']);
        });

        Schema::create('task_report_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_report_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('media_type', 20);
            $table->string('display_name');
            $table->string('storage_disk', 30)->default('local');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size');
            $table->string('status', 20)->default('uploading')->index();
            $table->string('upload_protocol', 30)->default('chunked-local');
            $table->string('upload_fingerprint', 64)->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();

            $table->index(['task_id', 'uploaded_by', 'task_report_id'], 'task_report_attachments_owner_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_report_attachments');
        Schema::dropIfExists('task_reports');

        Schema::table('task_user', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });

        Schema::table('task_user', function (Blueprint $table) {
            $table->dropColumn([
                'status',
                'started_at',
                'submitted_at',
                'completed_at',
            ]);
        });
    }
};
