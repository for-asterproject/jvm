<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PresentationAttachment extends Model
{
    use HasFactory;

    public const KIND_FILE = 'file';

    public const KIND_LINK = 'link';

    public const STATUS_UPLOADING = 'uploading';

    public const STATUS_READY = 'ready';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'presentation_id',
        'uploaded_by',
        'kind',
        'media_type',
        'display_name',
        'url',
        'storage_disk',
        'path',
        'original_name',
        'mime_type',
        'size',
        'status',
        'upload_protocol',
        'upload_fingerprint',
        'sort_order',
        'expires_at',
    ];

    protected $hidden = ['upload_fingerprint'];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'sort_order' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function presentation(): BelongsTo
    {
        return $this->belongsTo(Presentation::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
