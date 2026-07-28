<?php

namespace App\Http\Controllers;

use App\Http\Requests\PresentationRequest;
use App\Models\Presentation;
use App\Models\PresentationAttachment;
use App\Services\LocalPresentationUploadStorage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class PresentationController extends Controller
{
    public function __construct(
        private readonly LocalPresentationUploadStorage $uploadStorage,
    ) {}

    public function index(): Response
    {
        $this->authorize('viewAny', Presentation::class);

        $presentations = Presentation::query()
            ->with([
                'uploader:id,name',
                'attachments' => fn ($query) => $query
                    ->where('status', PresentationAttachment::STATUS_READY)
                    ->orderBy('sort_order')
                    ->orderBy('id'),
            ])
            ->latest()
            ->get()
            ->map(fn (Presentation $presentation) => $this->presentationPayload($presentation));

        return Inertia::render('crm/presentations', [
            'presentations' => $presentations,
            'canManage' => request()->user()->can('create', Presentation::class),
            'limits' => $this->limits(),
        ]);
    }

    public function show(Presentation $presentation): Response
    {
        $this->authorize('view', $presentation);

        $canManage = request()->user()->can('update', $presentation);
        $presentation->load([
            'uploader:id,name',
            'attachments' => fn ($query) => $query
                ->when(
                    ! $canManage,
                    fn ($attachmentQuery) => $attachmentQuery->where(
                        'status',
                        PresentationAttachment::STATUS_READY,
                    ),
                )
                ->orderBy('sort_order')
                ->orderBy('id'),
        ]);

        return Inertia::render('crm/presentation-show', [
            'presentation' => $this->presentationPayload($presentation),
            'canManage' => $canManage,
            'limits' => $this->limits(),
        ]);
    }

    public function store(PresentationRequest $request): RedirectResponse
    {
        $this->authorize('create', Presentation::class);

        $presentation = Presentation::create([
            ...$request->validated(),
            'source_type' => 'collection',
            'url' => null,
            'path' => null,
            'original_name' => null,
            'mime_type' => null,
            'size' => null,
            'uploaded_by' => $request->user()->id,
        ]);

        return to_route('presentations.show', $presentation)
            ->with('success', 'Презентация создана. Теперь добавьте материалы.');
    }

    public function update(
        PresentationRequest $request,
        Presentation $presentation,
    ): RedirectResponse {
        $this->authorize('update', $presentation);

        $presentation->update([
            ...$request->validated(),
            'source_type' => 'collection',
        ]);

        return back()->with('success', 'Презентация обновлена.');
    }

    public function download(Presentation $presentation): StreamedResponse
    {
        $this->authorize('view', $presentation);

        $attachment = $presentation->attachments()
            ->where('kind', PresentationAttachment::KIND_FILE)
            ->where('status', PresentationAttachment::STATUS_READY)
            ->firstOrFail();

        abort_unless($attachment->storage_disk === 'local', 404);
        abort_unless(Storage::disk('local')->exists($attachment->path), 404);

        return Storage::disk('local')->download(
            $attachment->path,
            $attachment->original_name ?? $attachment->display_name,
        );
    }

    public function destroy(Presentation $presentation): RedirectResponse
    {
        $this->authorize('delete', $presentation);

        $presentation->load('attachments');

        foreach ($presentation->attachments as $attachment) {
            try {
                $this->deleteAttachmentObject($attachment);
            } catch (Throwable $exception) {
                Log::warning('Не удалось удалить файл презентации из хранилища.', [
                    'presentation_id' => $presentation->id,
                    'attachment_id' => $attachment->id,
                    'exception' => $exception->getMessage(),
                ]);
            }
        }

        if ($presentation->path) {
            Storage::disk('local')->delete($presentation->path);
        }

        $presentation->delete();

        return to_route('presentations.index')
            ->with('success', 'Презентация удалена.');
    }

    private function presentationPayload(Presentation $presentation): array
    {
        $attachments = $presentation->attachments
            ->map(fn (PresentationAttachment $attachment) => [
                'id' => $attachment->id,
                'kind' => $attachment->kind,
                'media_type' => $attachment->media_type,
                'display_name' => $attachment->display_name,
                'url' => $attachment->url,
                'original_name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size' => $attachment->size,
                'status' => $attachment->status,
                'sort_order' => $attachment->sort_order,
                'view_url' => $attachment->kind === PresentationAttachment::KIND_FILE
                    && $attachment->status === PresentationAttachment::STATUS_READY
                    ? route('presentations.attachments.view', [$presentation, $attachment])
                    : null,
                'download_url' => $attachment->kind === PresentationAttachment::KIND_FILE
                    && $attachment->status === PresentationAttachment::STATUS_READY
                    ? route('presentations.attachments.download', [$presentation, $attachment])
                    : null,
                'created_at' => $attachment->created_at?->toISOString(),
            ])
            ->values();

        return [
            'id' => $presentation->id,
            'title' => $presentation->title,
            'description' => $presentation->description,
            'attachments' => $attachments,
            'attachments_count' => $attachments->where('status', PresentationAttachment::STATUS_READY)->count(),
            'total_size' => $attachments
                ->where('status', PresentationAttachment::STATUS_READY)
                ->sum('size'),
            'uploader' => $presentation->uploader
                ? [
                    'id' => $presentation->uploader->id,
                    'name' => $presentation->uploader->name,
                ]
                : null,
            'created_at' => $presentation->created_at?->toISOString(),
            'updated_at' => $presentation->updated_at?->toISOString(),
        ];
    }

    private function limits(): array
    {
        return [
            'max_attachments' => config('presentations.max_attachments'),
            'max_file_size' => config('presentations.max_file_size'),
            'max_total_size' => config('presentations.max_total_size'),
            'chunk_size' => config('presentations.chunk_size'),
            'parallel_uploads' => config('presentations.parallel_uploads'),
            'allowed_extensions' => array_keys(config('presentations.extensions')),
        ];
    }

    private function deleteAttachmentObject(PresentationAttachment $attachment): void
    {
        if ($attachment->kind !== PresentationAttachment::KIND_FILE || ! $attachment->path) {
            return;
        }

        if ($attachment->status === PresentationAttachment::STATUS_UPLOADING) {
            $this->uploadStorage->discard($attachment);

            return;
        }

        Storage::disk('local')->delete($attachment->path);
    }
}
