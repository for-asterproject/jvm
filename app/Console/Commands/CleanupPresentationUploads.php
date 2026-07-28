<?php

namespace App\Console\Commands;

use App\Models\PresentationAttachment;
use App\Services\LocalPresentationUploadStorage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class CleanupPresentationUploads extends Command
{
    protected $signature = 'presentations:cleanup-uploads';

    protected $description = 'Abort expired presentation uploads and release their quota';

    public function handle(LocalPresentationUploadStorage $uploadStorage): int
    {
        $cleaned = 0;

        PresentationAttachment::query()
            ->where('status', PresentationAttachment::STATUS_UPLOADING)
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->chunkById(100, function ($attachments) use ($uploadStorage, &$cleaned): void {
                foreach ($attachments as $attachment) {
                    try {
                        $uploadStorage->discard($attachment);
                    } catch (Throwable $exception) {
                        Log::warning('Не удалось очистить незавершённую загрузку презентации.', [
                            'attachment_id' => $attachment->id,
                            'exception' => $exception->getMessage(),
                        ]);
                    }

                    $attachment->update([
                        'status' => PresentationAttachment::STATUS_FAILED,
                        'upload_fingerprint' => null,
                        'expires_at' => null,
                    ]);
                    $cleaned++;
                }
            });

        $this->info("Очищено незавершённых загрузок: {$cleaned}");

        return self::SUCCESS;
    }
}
