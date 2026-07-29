<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\Pivot;

class TaskAssignment extends Pivot
{
    public const STATUS_PLANNED = 'planned';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_REVIEW = 'review';

    public const STATUS_NEEDS_REVISION = 'needs_revision';

    public const STATUS_DONE = 'done';

    public const STATUSES = [
        self::STATUS_PLANNED,
        self::STATUS_IN_PROGRESS,
        self::STATUS_REVIEW,
        self::STATUS_NEEDS_REVISION,
        self::STATUS_DONE,
    ];

    protected $table = 'task_user';

    public $incrementing = true;

    protected $fillable = [
        'task_id',
        'user_id',
        'status',
        'started_at',
        'submitted_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'submitted_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(TaskReport::class, 'task_assignment_id', 'id')->latest();
    }
}
