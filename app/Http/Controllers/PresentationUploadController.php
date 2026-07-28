<?php

namespace App\Http\Controllers;

use App\Http\Requests\PresentationUploadRequest;
use App\Models\Presentation;
use App\Models\PresentationAttachment;
use App\Services\LocalPresentationUploadStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PresentationUploadController extends Controller
{
    public function __construct(
        private readonly LocalPresentationUploadStorage $uploadStorage,
    ) {}

    public function store(
        PresentationUploadRequest $request,
        Presentation $presentation,
    ): JsonResponse {
        $attachment = $this->initializeUpload($request, $presentation);
        $attachment->update([
            'expires_at' => now()->addHours(
                config('presentations.pending_upload_ttl_hours'),
            ),
        ]);

        return response()->json([
            'attachment_id' => $attachment->id,
            'chunk_size' => config('presentations.chunk_size'),
            'total_chunks' => $this->uploadStorage->totalChunks($attachment),
            'uploaded_chunks' => $this->uploadStorage->uploadedChunks($attachment),
        ]);
    }

    public function storeChunk(
        Request $request,
        Presentation $presentation,
        PresentationAttachment $attachment,
        int $chunkIndex,
    ): JsonResponse {
        $this->authorizeUpload($presentation, $attachment);
        $input = $request->getContent(true);

        abort_unless(is_resource($input), 422);

        $contentLength = $request->headers->has('Content-Length')
            ? (int) $request->headers->get('Content-Length')
            : null;

        $this->uploadStorage->writeChunk(
            $attachment,
            $chunkIndex,
            $input,
            $contentLength,
        );
        $attachment->update([
            'expires_at' => now()->addHours(
                config('presentations.pending_upload_ttl_hours'),
            ),
        ]);

        return response()->json([
            'chunk_index' => $chunkIndex,
            'uploaded' => true,
        ]);
    }

    public function complete(
        Presentation $presentation,
        PresentationAttachment $attachment,
    ): JsonResponse {
        $this->authorizeUpload($presentation, $attachment);
        $this->uploadStorage->complete($attachment);

        if (Storage::disk('local')->size($attachment->path) !== $attachment->size) {
            $this->uploadStorage->discard($attachment);
            $attachment->update([
                'status' => PresentationAttachment::STATUS_FAILED,
                'expires_at' => null,
            ]);

            throw ValidationException::withMessages([
                'file' => 'Загруженный файл не прошёл проверку размера.',
            ]);
        }

        $attachment->update([
            'status' => PresentationAttachment::STATUS_READY,
            'upload_fingerprint' => null,
            'expires_at' => null,
        ]);

        return response()->json([
            'location' => route(
                'presentations.attachments.view',
                [$presentation, $attachment],
            ),
        ]);
    }

    public function abort(
        Presentation $presentation,
        PresentationAttachment $attachment,
    ): JsonResponse {
        $this->authorizeUpload($presentation, $attachment);
        $this->uploadStorage->discard($attachment);
        $attachment->delete();

        return response()->json([], 204);
    }

    private function initializeUpload(
        PresentationUploadRequest $request,
        Presentation $presentation,
    ): PresentationAttachment {
        $this->authorize('update', $presentation);

        $validated = $request->validated();
        $extension = strtolower(pathinfo($validated['name'], PATHINFO_EXTENSION));
        $format = config("presentations.extensions.{$extension}");
        $fingerprint = hash('sha256', implode('|', [
            $presentation->id,
            $request->user()->id,
            $validated['name'],
            $validated['size'],
            $validated['last_modified'] ?? 0,
        ]));

        return DB::transaction(function () use (
            $request,
            $presentation,
            $validated,
            $extension,
            $format,
            $fingerprint,
        ): PresentationAttachment {
            $lockedPresentation = Presentation::query()
                ->lockForUpdate()
                ->findOrFail($presentation->id);

            $existingUpload = $lockedPresentation->attachments()
                ->where('status', PresentationAttachment::STATUS_UPLOADING)
                ->where('upload_protocol', 'chunked-local')
                ->where('upload_fingerprint', $fingerprint)
                ->where('uploaded_by', $request->user()->id)
                ->where('expires_at', '>', now())
                ->first();

            if ($existingUpload) {
                return $existingUpload;
            }

            $attachmentCount = $lockedPresentation->attachments()
                ->whereIn('status', [
                    PresentationAttachment::STATUS_UPLOADING,
                    PresentationAttachment::STATUS_READY,
                ])
                ->count();

            if ($attachmentCount >= config('presentations.max_attachments')) {
                throw ValidationException::withMessages([
                    'attachments' => 'В одной презентации может быть не больше 10 материалов.',
                ]);
            }

            $totalSize = (int) $lockedPresentation->attachments()
                ->whereIn('status', [
                    PresentationAttachment::STATUS_UPLOADING,
                    PresentationAttachment::STATUS_READY,
                ])
                ->sum('size');

            if ($totalSize + (int) $validated['size'] > config('presentations.max_total_size')) {
                throw ValidationException::withMessages([
                    'size' => 'Общий объём материалов презентации не может превышать 5 ГБ.',
                ]);
            }

            $filePath = sprintf(
                'presentations/%d/%s.%s',
                $lockedPresentation->id,
                Str::uuid(),
                $extension,
            );

            return $lockedPresentation->attachments()->create([
                'uploaded_by' => $request->user()->id,
                'kind' => PresentationAttachment::KIND_FILE,
                'media_type' => $format['media_type'],
                'display_name' => $validated['name'],
                'storage_disk' => 'local',
                'path' => $filePath,
                'original_name' => $validated['name'],
                'mime_type' => $format['mime_type'],
                'size' => (int) $validated['size'],
                'status' => PresentationAttachment::STATUS_UPLOADING,
                'upload_protocol' => 'chunked-local',
                'upload_fingerprint' => $fingerprint,
                'sort_order' => ((int) $lockedPresentation->attachments()->max('sort_order')) + 1,
                'expires_at' => now()->addHours(
                    config('presentations.pending_upload_ttl_hours'),
                ),
            ]);
        });
    }

    private function authorizeUpload(
        Presentation $presentation,
        PresentationAttachment $attachment,
    ): void {
        $this->authorize('update', $presentation);
        abort_unless($attachment->presentation_id === $presentation->id, 404);
        abort_unless($attachment->status === PresentationAttachment::STATUS_UPLOADING, 409);
        abort_unless($attachment->upload_protocol === 'chunked-local', 409);
    }
}
