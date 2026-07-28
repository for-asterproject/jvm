<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PresentationLinkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'display_name' => ['required', 'string', 'max:255'],
            'url' => ['required', 'url:http,https', 'max:2000'],
        ];
    }
}
