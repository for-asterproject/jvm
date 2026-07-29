<?php

namespace App\Console\Commands;

use App\Models\TaskReportAttachment;
use App\Services\LocalTaskReportUploadStorage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class CleanupTaskReportUploads extends Command
{
    protected $signature = 'tasks:cleanup-report-uploads';

    protected $description = 'Delete expired task report uploads that were not attached to a report';

    public function handle(LocalTaskReportUploadStorage $uploadStorage): int
    {
        $cleaned = 0;

        TaskReportAttachment::query()
            ->whereNull('task_report_id')
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->chunkById(100, function ($attachments) use ($uploadStorage, &$cleaned): void {
                foreach ($attachments as $attachment) {
                    try {
                        $uploadStorage->discard($attachment);
                    } catch (Throwable $exception) {
                        Log::warning('Не удалось очистить незавершённую загрузку отчёта.', [
                            'attachment_id' => $attachment->id,
                            'exception' => $exception->getMessage(),
                        ]);
                    }

                    $attachment->delete();
                    $cleaned++;
                }
            });

        $this->info("Очищено незавершённых загрузок отчётов: {$cleaned}");

        return self::SUCCESS;
    }
}
