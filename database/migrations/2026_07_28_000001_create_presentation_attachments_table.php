<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('presentation_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('presentation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kind', 10)->index();
            $table->string('media_type', 20)->index();
            $table->string('display_name');
            $table->text('url')->nullable();
            $table->string('storage_disk', 50)->nullable();
            $table->string('path')->nullable()->index();
            $table->string('original_name')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->string('status', 20)->default('ready')->index();
            $table->string('upload_protocol', 20)->nullable();
            $table->string('upload_fingerprint', 64)->nullable()->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();

            $table->index(['presentation_id', 'status', 'sort_order'], 'presentation_attachments_listing_index');
        });

        DB::table('presentations')
            ->orderBy('id')
            ->each(function (object $presentation): void {
                if ($presentation->source_type === 'file' && $presentation->path) {
                    $extension = strtolower(pathinfo($presentation->original_name ?: $presentation->path, PATHINFO_EXTENSION));
                    $mediaType = match (true) {
                        in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true) => 'image',
                        in_array($extension, ['mp4', 'webm', 'mov'], true) => 'video',
                        $extension === 'zip' => 'archive',
                        default => 'document',
                    };

                    DB::table('presentation_attachments')->insert([
                        'presentation_id' => $presentation->id,
                        'uploaded_by' => $presentation->uploaded_by,
                        'kind' => 'file',
                        'media_type' => $mediaType,
                        'display_name' => $presentation->original_name ?: $presentation->title,
                        'storage_disk' => 'local',
                        'path' => $presentation->path,
                        'original_name' => $presentation->original_name,
                        'mime_type' => $presentation->mime_type,
                        'size' => (int) ($presentation->size ?? 0),
                        'status' => 'ready',
                        'sort_order' => 0,
                        'created_at' => $presentation->created_at,
                        'updated_at' => $presentation->updated_at,
                    ]);
                }

                if ($presentation->source_type === 'link' && $presentation->url) {
                    DB::table('presentation_attachments')->insert([
                        'presentation_id' => $presentation->id,
                        'uploaded_by' => $presentation->uploaded_by,
                        'kind' => 'link',
                        'media_type' => 'link',
                        'display_name' => $presentation->title,
                        'url' => $presentation->url,
                        'size' => 0,
                        'status' => 'ready',
                        'sort_order' => 0,
                        'created_at' => $presentation->created_at,
                        'updated_at' => $presentation->updated_at,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('presentation_attachments');
    }
};
