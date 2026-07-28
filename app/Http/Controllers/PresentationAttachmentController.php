<?php

namespace App\Http\Controllers;

use App\Http\Requests\PresentationAttachmentOrderRequest;
use App\Http\Requests\PresentationLinkRequest;
use App\Models\Presentation;
use App\Models\PresentationAttachment;
use App\Services\LocalPresentationUploadStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

class PresentationAttachmentController extends Controller
{
    public function __construct(
        private readonly LocalPresentationUploadStorage $uploadStorage,
    ) {}

    public function storeLink(
        PresentationLinkRequest $request,
        Presentation $presentation,
    ): RedirectResponse {
        $this->authorize('update', $presentation);

        DB::transaction(function () use ($request, $presentation): void {
            $lockedPresentation = Presentation::query()
                ->lockForUpdate()
                ->findOrFail($presentation->id);
            $this->ensureAttachmentSlotAvailable($lockedPresentation);

            $lockedPresentation->attachments()->create([
                ...$request->validated(),
                'uploaded_by' => $request->user()->id,
                'kind' => PresentationAttachment::KIND_LINK,
                'media_type' => 'link',
                'size' => 0,
                'status' => PresentationAttachment::STATUS_READY,
                'sort_order' => $this->nextSortOrder($lockedPresentation),
            ]);
        });

        return back()->with('success', 'Ссылка добавлена.');
    }

    public function reorder(
        PresentationAttachmentOrderRequest $request,
        Presentation $presentation,
    ): JsonResponse {
        $this->authorize('update', $presentation);

        $attachmentIds = $request->validated('attachment_ids');
        $existingIds = $presentation->attachments()
            ->whereIn('id', $attachmentIds)
            ->pluck('id')
            ->all();

        if (count($existingIds) !== count($attachmentIds)) {
            throw ValidationException::withMessages([
                'attachment_ids' => 'Один или несколько материалов не относятся к этой презентации.',
            ]);
        }

        DB::transaction(function () use ($attachmentIds, $presentation): void {
            foreach ($attachmentIds as $index => $attachmentId) {
                $presentation->attachments()
                    ->whereKey($attachmentId)
                    ->update(['sort_order' => $index]);
            }
        });

        return response()->json(['message' => 'Порядок материалов обновлён.']);
    }

    public function view(
        Presentation $presentation,
        PresentationAttachment $attachment,
    ): BinaryFileResponse {
        $this->authorize('view', $presentation);
        $this->ensureBelongsToPresentation($presentation, $attachment);
        $this->ensureReadyFile($attachment);

        return $this->fileResponse(
            $attachment,
            ResponseHeaderBag::DISPOSITION_INLINE,
        );
    }

    public function download(
        Presentation $presentation,
        PresentationAttachment $attachment,
    ): BinaryFileResponse {
        $this->authorize('view', $presentation);
        $this->ensureBelongsToPresentation($presentation, $attachment);
        $this->ensureReadyFile($attachment);

        return $this->fileResponse(
            $attachment,
            ResponseHeaderBag::DISPOSITION_ATTACHMENT,
        );
    }

    public function destroy(
        Presentation $presentation,
        PresentationAttachment $attachment,
    ): RedirectResponse {
        $this->authorize('update', $presentation);
        $this->ensureBelongsToPresentation($presentation, $attachment);

        if ($attachment->kind === PresentationAttachment::KIND_FILE && $attachment->path) {
            if ($attachment->status === PresentationAttachment::STATUS_UPLOADING) {
                $this->uploadStorage->discard($attachment);
            } else {
                Storage::disk('local')->delete($attachment->path);
            }
        }

        $attachment->delete();

        return back()->with('success', 'Материал удалён.');
    }

    private function ensureAttachmentSlotAvailable(Presentation $presentation): void
    {
        $count = $presentation->attachments()
            ->whereIn('status', [
                PresentationAttachment::STATUS_UPLOADING,
                PresentationAttachment::STATUS_READY,
            ])
            ->count();

        if ($count >= config('presentations.max_attachments')) {
            throw ValidationException::withMessages([
                'attachments' => 'В одной презентации может быть не больше 10 материалов.',
            ]);
        }
    }

    private function nextSortOrder(Presentation $presentation): int
    {
        return ((int) $presentation->attachments()->max('sort_order')) + 1;
    }

    private function ensureBelongsToPresentation(
        Presentation $presentation,
        PresentationAttachment $attachment,
    ): void {
        abort_unless($attachment->presentation_id === $presentation->id, 404);
    }

    private function ensureReadyFile(PresentationAttachment $attachment): void
    {
        abort_unless(
            $attachment->kind === PresentationAttachment::KIND_FILE
            && $attachment->status === PresentationAttachment::STATUS_READY
            && $attachment->path,
            404,
        );

        abort_unless($attachment->storage_disk === 'local', 404);
        abort_unless(Storage::disk('local')->exists($attachment->path), 404);
    }

    private function fileResponse(
        PresentationAttachment $attachment,
        string $disposition,
    ): BinaryFileResponse {
        $fileName = $attachment->original_name ?? $attachment->display_name;
        $fallback = preg_replace(
            '/[^A-Za-z0-9._-]/',
            '_',
            Str::ascii($fileName),
        ) ?: 'download';
        $response = response()->file(
            Storage::disk('local')->path($attachment->path),
            ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream'],
        );
        $response->setContentDisposition($disposition, $fileName, $fallback);

        return $response;
    }
}
