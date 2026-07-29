<?php

namespace App\Services;

use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\TaskReport;
use App\Models\TaskReportAttachment;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaskWorkflowService
{
    public function start(Task $task, User $user): TaskAssignment
    {
        return DB::transaction(function () use ($task, $user): TaskAssignment {
            $assignment = $this->lockedAssignment($task, $user);

            if ($assignment->status !== TaskAssignment::STATUS_PLANNED) {
                throw ValidationException::withMessages([
                    'status' => 'Эту задачу уже нельзя взять в работу.',
                ]);
            }

            $assignment->update([
                'status' => TaskAssignment::STATUS_IN_PROGRESS,
                'started_at' => now(),
            ]);
            $this->refreshTaskStatus($task);

            return $assignment->refresh();
        });
    }

    /**
     * @param  array<int, int>  $attachmentIds
     */
    public function submitReport(Task $task, User $user, string $body, array $attachmentIds): TaskReport
    {
        return DB::transaction(function () use ($task, $user, $body, $attachmentIds): TaskReport {
            $assignment = $this->lockedAssignment($task, $user);

            if (! in_array($assignment->status, [
                TaskAssignment::STATUS_IN_PROGRESS,
                TaskAssignment::STATUS_NEEDS_REVISION,
            ], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Сейчас отчёт по этой задаче отправить нельзя.',
                ]);
            }

            $attachments = $this->lockedAttachments($task, $user, $attachmentIds);
            $report = TaskReport::create([
                'task_id' => $task->id,
                'task_assignment_id' => $assignment->id,
                'user_id' => $user->id,
                'body' => trim($body),
                'status' => TaskReport::STATUS_PENDING,
            ]);

            if ($attachments->isNotEmpty()) {
                TaskReportAttachment::query()
                    ->whereKey($attachments->pluck('id'))
                    ->update([
                        'task_report_id' => $report->id,
                        'expires_at' => null,
                    ]);
            }

            $assignment->update([
                'status' => TaskAssignment::STATUS_REVIEW,
                'submitted_at' => now(),
                'completed_at' => null,
            ]);
            $this->refreshTaskStatus($task);

            return $report->load(['author:id,name,email', 'attachments']);
        });
    }

    public function accept(Task $task, TaskReport $report, User $reviewer): TaskReport
    {
        return DB::transaction(function () use ($task, $report, $reviewer): TaskReport {
            $report = TaskReport::query()->lockForUpdate()->findOrFail($report->id);
            $this->ensureReportCanBeReviewed($task, $report);
            $assignment = TaskAssignment::query()->lockForUpdate()->findOrFail($report->task_assignment_id);

            $report->update([
                'status' => TaskReport::STATUS_ACCEPTED,
                'reviewed_by' => $reviewer->id,
                'review_comment' => null,
                'reviewed_at' => now(),
            ]);
            $assignment->update([
                'status' => TaskAssignment::STATUS_DONE,
                'completed_at' => now(),
            ]);
            $this->refreshTaskStatus($task);

            return $report->refresh();
        });
    }

    public function requestRevision(Task $task, TaskReport $report, User $reviewer, string $comment): TaskReport
    {
        return DB::transaction(function () use ($task, $report, $reviewer, $comment): TaskReport {
            $report = TaskReport::query()->lockForUpdate()->findOrFail($report->id);
            $this->ensureReportCanBeReviewed($task, $report);
            $assignment = TaskAssignment::query()->lockForUpdate()->findOrFail($report->task_assignment_id);

            $report->update([
                'status' => TaskReport::STATUS_REVISION_REQUESTED,
                'reviewed_by' => $reviewer->id,
                'review_comment' => trim($comment),
                'reviewed_at' => now(),
            ]);
            $assignment->update([
                'status' => TaskAssignment::STATUS_NEEDS_REVISION,
                'completed_at' => null,
            ]);
            $this->refreshTaskStatus($task);

            return $report->refresh();
        });
    }

    public function refreshTaskStatus(Task $task): string
    {
        Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
        $statuses = TaskAssignment::query()
            ->where('task_id', $task->id)
            ->pluck('status');
        $status = $this->aggregateStatus($statuses);
        Task::query()->whereKey($task->id)->update(['status' => $status]);
        $task->status = $status;

        return $status;
    }

    /**
     * @param  Collection<int, string>  $statuses
     */
    private function aggregateStatus(Collection $statuses): string
    {
        if ($statuses->contains(TaskAssignment::STATUS_NEEDS_REVISION)) {
            return TaskAssignment::STATUS_NEEDS_REVISION;
        }

        if ($statuses->contains(TaskAssignment::STATUS_REVIEW)) {
            return TaskAssignment::STATUS_REVIEW;
        }

        if ($statuses->isNotEmpty() && $statuses->every(
            fn (string $status) => $status === TaskAssignment::STATUS_DONE,
        )) {
            return TaskAssignment::STATUS_DONE;
        }

        if ($statuses->contains(fn (string $status) => in_array($status, [
            TaskAssignment::STATUS_IN_PROGRESS,
            TaskAssignment::STATUS_DONE,
        ], true))) {
            return TaskAssignment::STATUS_IN_PROGRESS;
        }

        return TaskAssignment::STATUS_PLANNED;
    }

    private function lockedAssignment(Task $task, User $user): TaskAssignment
    {
        $assignment = TaskAssignment::query()
            ->where('task_id', $task->id)
            ->where('user_id', $user->id)
            ->lockForUpdate()
            ->first();

        if (! $assignment) {
            abort(403);
        }

        return $assignment;
    }

    /**
     * @param  array<int, int>  $attachmentIds
     * @return Collection<int, TaskReportAttachment>
     */
    private function lockedAttachments(Task $task, User $user, array $attachmentIds): Collection
    {
        if ($attachmentIds === []) {
            return collect();
        }

        $attachments = TaskReportAttachment::query()
            ->whereKey($attachmentIds)
            ->where('task_id', $task->id)
            ->where('uploaded_by', $user->id)
            ->whereNull('task_report_id')
            ->where('status', TaskReportAttachment::STATUS_READY)
            ->lockForUpdate()
            ->get();

        if ($attachments->count() !== count(array_unique($attachmentIds))) {
            throw ValidationException::withMessages([
                'attachment_ids' => 'Один или несколько файлов недоступны для этого отчёта.',
            ]);
        }

        return $attachments;
    }

    private function ensureReportCanBeReviewed(Task $task, TaskReport $report): void
    {
        if ($report->task_id !== $task->id || $report->status !== TaskReport::STATUS_PENDING) {
            throw ValidationException::withMessages([
                'report' => 'Этот отчёт уже проверен или относится к другой задаче.',
            ]);
        }

        $hasNewerReport = TaskReport::query()
            ->where('task_assignment_id', $report->task_assignment_id)
            ->where('id', '>', $report->id)
            ->exists();

        if ($hasNewerReport) {
            throw ValidationException::withMessages([
                'report' => 'Этот отчёт уже не является актуальным.',
            ]);
        }
    }
}
