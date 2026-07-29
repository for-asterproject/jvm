<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TaskReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:10000'],
            'attachment_ids' => ['nullable', 'array', 'max:'.config('task_reports.max_attachments')],
            'attachment_ids.*' => ['required', 'integer', 'distinct', 'exists:task_report_attachments,id'],
        ];
    }
}
