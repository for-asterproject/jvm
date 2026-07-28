<?php

namespace App\Services;

use App\Models\PresentationAttachment;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class LocalPresentationUploadStorage
{
    /** @return array<int, int> */
    public function uploadedChunks(PresentationAttachment $attachment): array
    {
        $uploaded = [];

        for ($chunkIndex = 0; $chunkIndex < $this->totalChunks($attachment); $chunkIndex++) {
            $marker = $this->markerPath($attachment, $chunkIndex);

            if (Storage::disk('local')->exists($marker)
                && trim(Storage::disk('local')->get($marker)) === (string) $this->expectedChunkSize($attachment, $chunkIndex)) {
                $uploaded[] = $chunkIndex;
            }
        }

        return $uploaded;
    }

    /**
     * @param  resource  $input
     */
    public function writeChunk(
        PresentationAttachment $attachment,
        int $chunkIndex,
        $input,
        ?int $contentLength,
    ): void {
        $this->validateChunkIndex($attachment, $chunkIndex);
        $expectedSize = $this->expectedChunkSize($attachment, $chunkIndex);

        if ($contentLength !== null && $contentLength !== $expectedSize) {
            throw ValidationException::withMessages([
                'chunk' => 'Размер части файла не совпадает с ожидаемым.',
            ]);
        }

        $disk = Storage::disk('local');
        $lockPath = $disk->path($this->lockFilePath($attachment));
        File::ensureDirectoryExists(dirname($lockPath));
        $lock = fopen($lockPath, 'c+b');

        if (! is_resource($lock)) {
            throw new RuntimeException('Не удалось открыть блокировку загрузки.');
        }

        $alreadyComplete = false;

        try {
            if (! flock($lock, LOCK_EX)) {
                throw new RuntimeException('Не удалось заблокировать загрузку.');
            }

            if ($disk->exists($attachment->path)
                && $disk->size($attachment->path) === $attachment->size) {
                $alreadyComplete = true;
            } else {
                $disk->delete($this->markerPath($attachment, $chunkIndex));
                $temporaryPath = $disk->path($this->temporaryFilePath($attachment));
                $output = fopen($temporaryPath, 'c+b');

                if (! is_resource($output)) {
                    throw new RuntimeException('Не удалось открыть временный файл для записи.');
                }

                try {
                    if (fseek($output, $chunkIndex * $this->chunkSize()) !== 0) {
                        throw new RuntimeException('Не удалось перейти к позиции части файла.');
                    }

                    $written = stream_copy_to_stream($input, $output, $expectedSize);
                    $hasExtraBytes = fread($input, 1);

                    if ($written !== $expectedSize || $hasExtraBytes === false || $hasExtraBytes !== '') {
                        throw ValidationException::withMessages([
                            'chunk' => 'Получена неполная или повреждённая часть файла.',
                        ]);
                    }

                    fflush($output);
                } finally {
                    fclose($output);
                }

                $disk->put(
                    $this->markerPath($attachment, $chunkIndex),
                    (string) $expectedSize,
                );
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }

        if ($alreadyComplete) {
            $disk->deleteDirectory($this->uploadDirectory($attachment));
        }
    }

    public function complete(PresentationAttachment $attachment): void
    {
        $disk = Storage::disk('local');

        $lockPath = $disk->path($this->lockFilePath($attachment));
        File::ensureDirectoryExists(dirname($lockPath));
        $lock = fopen($lockPath, 'c+b');

        if (! is_resource($lock)) {
            throw new RuntimeException('Не удалось открыть блокировку загрузки.');
        }

        try {
            if (! flock($lock, LOCK_EX)) {
                throw new RuntimeException('Не удалось заблокировать загрузку.');
            }

            if ($disk->exists($attachment->path)
                && $disk->size($attachment->path) === $attachment->size) {
                // A previous completion request already moved the file.
            } else {
                if (count($this->uploadedChunks($attachment)) !== $this->totalChunks($attachment)) {
                    throw ValidationException::withMessages([
                        'file' => 'Не все части файла загружены.',
                    ]);
                }

                $temporaryPath = $disk->path($this->temporaryFilePath($attachment));

                clearstatcache(true, $temporaryPath);
                if (! is_file($temporaryPath) || filesize($temporaryPath) !== $attachment->size) {
                    throw ValidationException::withMessages([
                        'file' => 'Итоговый размер файла не совпадает с ожидаемым.',
                    ]);
                }

                $finalPath = $disk->path($attachment->path);
                File::ensureDirectoryExists(dirname($finalPath));

                if (! rename($temporaryPath, $finalPath)) {
                    throw new RuntimeException('Не удалось сохранить загруженный файл.');
                }
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }

        $disk->deleteDirectory($this->uploadDirectory($attachment));
    }

    public function discard(PresentationAttachment $attachment): void
    {
        Storage::disk('local')->deleteDirectory($this->uploadDirectory($attachment));

        if ($attachment->path) {
            Storage::disk('local')->delete($attachment->path);
        }
    }

    public function totalChunks(PresentationAttachment $attachment): int
    {
        return max(1, (int) ceil($attachment->size / $this->chunkSize()));
    }

    private function validateChunkIndex(
        PresentationAttachment $attachment,
        int $chunkIndex,
    ): void {
        if ($chunkIndex < 0 || $chunkIndex >= $this->totalChunks($attachment)) {
            throw ValidationException::withMessages([
                'chunk' => 'Неверный номер части файла.',
            ]);
        }
    }

    private function expectedChunkSize(
        PresentationAttachment $attachment,
        int $chunkIndex,
    ): int {
        return (int) min(
            $this->chunkSize(),
            $attachment->size - ($chunkIndex * $this->chunkSize()),
        );
    }

    private function chunkSize(): int
    {
        return (int) config('presentations.chunk_size');
    }

    private function uploadDirectory(PresentationAttachment $attachment): string
    {
        return "presentation-upload-chunks/{$attachment->id}";
    }

    private function temporaryFilePath(PresentationAttachment $attachment): string
    {
        return $this->uploadDirectory($attachment).'/payload.part';
    }

    private function lockFilePath(PresentationAttachment $attachment): string
    {
        return $this->uploadDirectory($attachment).'/upload.lock';
    }

    private function markerPath(
        PresentationAttachment $attachment,
        int $chunkIndex,
    ): string {
        return sprintf(
            '%s/%05d.done',
            $this->uploadDirectory($attachment),
            $chunkIndex,
        );
    }
}
