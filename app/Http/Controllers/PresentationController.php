<?php

namespace App\Http\Controllers;

use App\Http\Requests\PresentationRequest;
use App\Models\Presentation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PresentationController extends Controller
{
    public function index(): Response
    {
        $this->authorize('viewAny', Presentation::class);

        return Inertia::render('crm/presentations', [
            'presentations' => Presentation::query()
                ->with('uploader:id,name')
                ->latest()
                ->get(),
            'canManage' => request()->user()->can('create', Presentation::class),
        ]);
    }

    public function store(PresentationRequest $request): RedirectResponse
    {
        $this->authorize('create', Presentation::class);

        $data = $this->presentationData($request);
        Presentation::create([
            ...$data,
            'uploaded_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Презентация добавлена.');
    }

    public function update(PresentationRequest $request, Presentation $presentation): RedirectResponse
    {
        $this->authorize('update', $presentation);

        $oldPath = $presentation->path;
        $data = $this->presentationData($request, $presentation);
        $presentation->update($data);

        if ($oldPath && $oldPath !== $presentation->path) {
            Storage::disk('local')->delete($oldPath);
        }

        return back()->with('success', 'Презентация обновлена.');
    }

    public function download(Presentation $presentation): StreamedResponse
    {
        $this->authorize('view', $presentation);
        abort_unless($presentation->source_type === 'file' && $presentation->path, 404);
        abort_unless(Storage::disk('local')->exists($presentation->path), 404);

        return Storage::disk('local')->download(
            $presentation->path,
            $presentation->original_name ?? basename($presentation->path),
        );
    }

    public function destroy(Presentation $presentation): RedirectResponse
    {
        $this->authorize('delete', $presentation);

        if ($presentation->path) {
            Storage::disk('local')->delete($presentation->path);
        }

        $presentation->delete();

        return back()->with('success', 'Презентация удалена.');
    }

    private function presentationData(
        PresentationRequest $request,
        ?Presentation $presentation = null,
    ): array {
        $validated = $request->validated();
        $data = [
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'source_type' => $validated['source_type'],
        ];

        if ($validated['source_type'] === 'link') {
            return [
                ...$data,
                'url' => $validated['url'],
                'path' => null,
                'original_name' => null,
                'mime_type' => null,
                'size' => null,
            ];
        }

        if ($request->hasFile('file')) {
            $file = $request->file('file');

            return [
                ...$data,
                'url' => null,
                'path' => $file->store('presentations', 'local'),
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
            ];
        }

        return [
            ...$data,
            'url' => null,
            'path' => $presentation?->path,
            'original_name' => $presentation?->original_name,
            'mime_type' => $presentation?->mime_type,
            'size' => $presentation?->size,
        ];
    }
}
