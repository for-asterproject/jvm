<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskReportAttachment extends Model
{
    public const STATUS_UPLOADING = 'uploading';

    public const STATUS_READY = 'ready';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'task_id',
        'task_report_id',
        'uploaded_by',
        'media_type',
        'display_name',
        'storage_disk',
        'path',
        'original_name',
        'mime_type',
        'size',
        'status',
        'upload_protocol',
        'upload_fingerprint',
        'expires_at',
    ];

    protected $hidden = ['upload_fingerprint', 'path', 'storage_disk'];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(TaskReport::class, 'task_report_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
