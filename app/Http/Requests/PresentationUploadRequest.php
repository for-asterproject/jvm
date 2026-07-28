<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class PresentationUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.config('presentations.max_file_size')],
            'mime_type' => ['nullable', 'string', 'max:255'],
            'last_modified' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $extension = strtolower(pathinfo((string) $this->input('name'), PATHINFO_EXTENSION));

                if (! array_key_exists($extension, config('presentations.extensions'))) {
                    $validator->errors()->add(
                        'name',
                        'Этот формат файла не поддерживается.',
                    );
                }
            },
        ];
    }
}
