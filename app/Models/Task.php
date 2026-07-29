<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use HasFactory;

    public const STATUSES = ['planned', 'in_progress', 'review', 'done'];

    public const PRIORITIES = ['low', 'normal', 'high'];

    protected $fillable = [
        'project_id',
        'division',
        'title',
        'description',
        'status',
        'priority',
        'assignee_id',
        'creator_id',
        'due_date',
    ];

    protected function casts(): array
    {
        return ['due_date' => 'date:Y-m-d'];
    }

    protected static function booted(): void
    {
        static::creating(function (Task $task) {
            if (! $task->division && $task->project_id) {
                $task->division = Project::query()->whereKey($task->project_id)->value('division');
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->isAdministrator()) {
            return $query;
        }

        return $query->where(function (Builder $tasks) use ($user) {
            $tasks
                ->where('assignee_id', $user->id)
                ->orWhere('creator_id', $user->id)
                ->orWhereHas('project', function (Builder $projects) use ($user) {
                    $projects
                        ->where('manager_id', $user->id)
                        ->orWhereHas('members', fn (Builder $members) => $members->whereKey($user->id));
                });

            if ($user->isManager()) {
                $tasks->orWhereHas('assignee', fn (Builder $assignees) => $assignees->where('manager_id', $user->id));
            }
        });
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class)->oldest();
    }
}
