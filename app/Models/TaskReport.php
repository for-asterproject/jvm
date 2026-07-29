<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaskReport extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_REVISION_REQUESTED = 'revision_requested';

    protected $fillable = [
        'task_id',
        'task_assignment_id',
        'user_id',
        'body',
        'status',
        'reviewed_by',
        'review_comment',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(TaskAssignment::class, 'task_assignment_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskReportAttachment::class);
    }
}
