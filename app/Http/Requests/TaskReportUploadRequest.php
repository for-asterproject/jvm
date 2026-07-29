<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class TaskReportUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.config('task_reports.max_file_size')],
            'mime_type' => ['nullable', 'string', 'max:255'],
            'last_modified' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $extension = strtolower(pathinfo((string) $this->input('name'), PATHINFO_EXTENSION));

                if (! array_key_exists($extension, config('task_reports.extensions'))) {
                    $validator->errors()->add('name', 'Этот формат файла не поддерживается.');
                }
            },
        ];
    }
}
