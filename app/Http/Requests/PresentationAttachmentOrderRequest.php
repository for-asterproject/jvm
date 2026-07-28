<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PresentationAttachmentOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'attachment_ids' => [
                'required',
                'array',
                'max:'.config('presentations.max_attachments'),
            ],
            'attachment_ids.*' => ['required', 'integer', 'distinct'],
        ];
    }
}
