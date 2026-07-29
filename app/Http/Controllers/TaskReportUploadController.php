<?php

namespace App\Http\Controllers;

use App\Http\Requests\TaskReportUploadRequest;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\TaskReportAttachment;
use App\Services\LocalTaskReportUploadStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

class TaskReportUploadController extends Controller
{
    public function __construct(
        private readonly LocalTaskReportUploadStorage $uploadStorage,
    ) {}

    public function store(TaskReportUploadRequest $request, Task $task): JsonResponse
    {
        $this->authorizeActiveAssignment($request, $task);
        $validated = $request->validated();
        $extension = strtolower(pathinfo($validated['name'], PATHINFO_EXTENSION));
        $format = config("task_reports.extensions.{$extension}");
        $fingerprint = hash('sha256', implode('|', [
            $task->id,
            $request->user()->id,
            $validated['name'],
            $validated['size'],
            $validated['last_modified'] ?? 0,
        ]));

        $attachment = DB::transaction(function () use (
            $request,
            $task,
            $validated,
            $extension,
            $format,
            $fingerprint,
        ): TaskReportAttachment {
            Task::query()->lockForUpdate()->findOrFail($task->id);

            $existing = TaskReportAttachment::query()
                ->where('task_id', $task->id)
                ->where('uploaded_by', $request->user()->id)
                ->whereNull('task_report_id')
                ->where('upload_fingerprint', $fingerprint)
                ->where('expires_at', '>', now())
                ->first();

            if ($existing) {
                return $existing;
            }

            $pendingCount = TaskReportAttachment::query()
                ->where('task_id', $task->id)
                ->where('uploaded_by', $request->user()->id)
                ->whereNull('task_report_id')
                ->whereIn('status', [
                    TaskReportAttachment::STATUS_UPLOADING,
                    TaskReportAttachment::STATUS_READY,
                ])
                ->count();

            if ($pendingCount >= config('task_reports.max_attachments')) {
                throw ValidationException::withMessages([
                    'attachments' => 'К одному отчёту можно приложить не больше 3 файлов.',
                ]);
            }

            return TaskReportAttachment::create([
                'task_id' => $task->id,
                'uploaded_by' => $request->user()->id,
                'media_type' => $format['media_type'],
                'display_name' => $validated['name'],
                'storage_disk' => 'local',
                'path' => sprintf(
                    'task-reports/%d/%d/%s.%s',
                    $task->id,
                    $request->user()->id,
                    Str::uuid(),
                    $extension,
                ),
                'original_name' => $validated['name'],
                'mime_type' => $format['mime_type'],
                'size' => (int) $validated['size'],
                'status' => TaskReportAttachment::STATUS_UPLOADING,
                'upload_protocol' => 'chunked-local',
                'upload_fingerprint' => $fingerprint,
                'expires_at' => now()->addHours(config('task_reports.pending_upload_ttl_hours')),
            ]);
        });

        return response()->json([
            'attachment_id' => $attachment->id,
            'upload_complete' => $attachment->status === TaskReportAttachment::STATUS_READY,
            'chunk_size' => config('task_reports.chunk_size'),
            'total_chunks' => $this->uploadStorage->totalChunks($attachment),
            'uploaded_chunks' => $this->uploadStorage->uploadedChunks($attachment),
        ]);
    }

    public function storeChunk(
        Request $request,
        Task $task,
        TaskReportAttachment $attachment,
        int $chunkIndex,
    ): JsonResponse {
        $this->authorizeUpload($request, $task, $attachment);
        $input = $request->getContent(true);
        abort_unless(is_resource($input), 422);

        $this->uploadStorage->writeChunk(
            $attachment,
            $chunkIndex,
            $input,
            $request->headers->has('Content-Length')
                ? (int) $request->headers->get('Content-Length')
                : null,
        );
        $attachment->update([
            'expires_at' => now()->addHours(config('task_reports.pending_upload_ttl_hours')),
        ]);

        return response()->json(['chunk_index' => $chunkIndex, 'uploaded' => true]);
    }

    public function complete(
        Request $request,
        Task $task,
        TaskReportAttachment $attachment,
    ): JsonResponse {
        $this->authorizeUpload($request, $task, $attachment);
        $this->uploadStorage->complete($attachment);

        if (Storage::disk('local')->size($attachment->path) !== $attachment->size) {
            $this->uploadStorage->discard($attachment);
            $attachment->update([
                'status' => TaskReportAttachment::STATUS_FAILED,
                'upload_fingerprint' => null,
            ]);
            throw ValidationException::withMessages([
                'file' => 'Загруженный файл не прошёл проверку размера.',
            ]);
        }

        $attachment->update([
            'status' => TaskReportAttachment::STATUS_READY,
            'upload_fingerprint' => null,
            'expires_at' => now()->addHours(config('task_reports.pending_upload_ttl_hours')),
        ]);

        return response()->json([
            'attachment_id' => $attachment->id,
            'display_name' => $attachment->display_name,
        ]);
    }

    public function abort(
        Request $request,
        Task $task,
        TaskReportAttachment $attachment,
    ): JsonResponse {
        $this->authorizeUpload($request, $task, $attachment, allowReady: true);
        $this->uploadStorage->discard($attachment);
        $attachment->delete();

        return response()->json([], 204);
    }

    public function view(Task $task, TaskReportAttachment $attachment): BinaryFileResponse
    {
        return $this->fileResponse($task, $attachment, ResponseHeaderBag::DISPOSITION_INLINE);
    }

    public function download(Task $task, TaskReportAttachment $attachment): BinaryFileResponse
    {
        return $this->fileResponse($task, $attachment, ResponseHeaderBag::DISPOSITION_ATTACHMENT);
    }

    private function authorizeActiveAssignment(Request $request, Task $task): void
    {
        $this->authorize('work', $task);
        $allowed = TaskAssignment::query()
            ->where('task_id', $task->id)
            ->where('user_id', $request->user()->id)
            ->whereIn('status', [
                TaskAssignment::STATUS_IN_PROGRESS,
                TaskAssignment::STATUS_NEEDS_REVISION,
            ])
            ->exists();
        abort_unless($allowed, 409);
    }

    private function authorizeUpload(
        Request $request,
        Task $task,
        TaskReportAttachment $attachment,
        bool $allowReady = false,
    ): void {
        $this->authorizeActiveAssignment($request, $task);
        abort_unless($attachment->task_id === $task->id, 404);
        abort_unless($attachment->uploaded_by === $request->user()->id, 403);
        abort_unless($attachment->task_report_id === null, 409);
        abort_unless(
            $attachment->status === TaskReportAttachment::STATUS_UPLOADING
                || ($allowReady && $attachment->status === TaskReportAttachment::STATUS_READY),
            409,
        );
    }

    private function fileResponse(
        Task $task,
        TaskReportAttachment $attachment,
        string $disposition,
    ): BinaryFileResponse {
        $this->authorize('view', $task);
        abort_unless($attachment->task_id === $task->id, 404);
        abort_unless($attachment->task_report_id !== null, 404);
        abort_unless($attachment->status === TaskReportAttachment::STATUS_READY, 404);
        abort_unless(Storage::disk($attachment->storage_disk)->exists($attachment->path), 404);

        $fallback = preg_replace(
            '/[^A-Za-z0-9._-]/',
            '_',
            Str::ascii($attachment->original_name),
        ) ?: 'download';
        $response = response()->file(
            Storage::disk($attachment->storage_disk)->path($attachment->path),
            ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream'],
        );
        $response->setContentDisposition(
            $disposition,
            $attachment->original_name,
            $fallback,
        );

        return $response;
    }
}
