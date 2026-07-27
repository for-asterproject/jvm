<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;

class PresentationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $presentation = $this->route('presentation');
        $needsFile = $this->input('source_type') === 'file'
            && (! $presentation || ! $presentation->path);

        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'source_type' => ['required', Rule::in(['file', 'link'])],
            'url' => [
                Rule::requiredIf($this->input('source_type') === 'link'),
                'nullable',
                'url:http,https',
                'max:2000',
            ],
            'file' => [
                Rule::requiredIf($needsFile),
                'nullable',
                File::types(['pdf', 'ppt', 'pptx'])->max(25 * 1024),
            ],
        ];
    }
}
