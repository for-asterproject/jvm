<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Presentation extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'source_type',
        'url',
        'path',
        'original_name',
        'mime_type',
        'size',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(PresentationAttachment::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
