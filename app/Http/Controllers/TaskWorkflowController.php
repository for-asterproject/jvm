<?php

namespace App\Http\Controllers;

use App\Http\Requests\TaskReportRequest;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\TaskReport;
use App\Models\TaskReportAttachment;
use App\Services\TaskWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskWorkflowController extends Controller
{
    public function __construct(
        private readonly TaskWorkflowService $workflow,
    ) {}

    public function show(Request $request, Task $task): JsonResponse
    {
        $this->authorize('view', $task);
        $task->load([
            'assignments.user:id,name,email',
            'assignments.reports.author:id,name,email',
            'assignments.reports.reviewer:id,name,email',
            'assignments.reports.attachments',
        ]);

        return response()->json([
            'task' => [
                'id' => $task->id,
                'status' => $task->status,
                'can_review_reports' => $request->user()->can('reviewReports', $task),
                'assignments' => $task->assignments->map(fn (TaskAssignment $assignment) => [
                    ...$this->assignmentPayload($assignment, $request->user()->id),
                    'reports' => $assignment->reports->map(
                        fn (TaskReport $report) => $this->reportPayload($task, $report),
                    ),
                ]),
            ],
            'limits' => [
                'max_attachments' => config('task_reports.max_attachments'),
                'max_file_size' => config('task_reports.max_file_size'),
                'chunk_size' => config('task_reports.chunk_size'),
                'allowed_extensions' => array_keys(config('task_reports.extensions')),
            ],
        ]);
    }

    public function start(Request $request, Task $task): JsonResponse
    {
        $this->authorize('work', $task);
        $this->workflow->start($task, $request->user());

        return response()->json(['message' => 'Задача взята в работу.']);
    }

    public function submit(TaskReportRequest $request, Task $task): JsonResponse
    {
        $this->authorize('work', $task);
        $report = $this->workflow->submitReport(
            $task,
            $request->user(),
            $request->validated('body'),
            $request->validated('attachment_ids', []),
        );

        return response()->json([
            'message' => 'Отчёт отправлен на проверку.',
            'report_id' => $report->id,
        ], 201);
    }

    public function accept(Request $request, Task $task, TaskReport $report): JsonResponse
    {
        $this->authorize('reviewReports', $task);
        $this->workflow->accept($task, $report, $request->user());

        return response()->json(['message' => 'Отчёт принят.']);
    }

    public function revision(Request $request, Task $task, TaskReport $report): JsonResponse
    {
        $this->authorize('reviewReports', $task);
        $validated = $request->validate([
            'comment' => ['required', 'string', 'max:5000'],
        ]);
        $this->workflow->requestRevision(
            $task,
            $report,
            $request->user(),
            $validated['comment'],
        );

        return response()->json(['message' => 'Отчёт возвращён на доработку.']);
    }

    private function assignmentPayload(TaskAssignment $assignment, int $currentUserId): array
    {
        return [
            'id' => $assignment->id,
            'user_id' => $assignment->user_id,
            'user' => $assignment->user,
            'status' => $assignment->status,
            'started_at' => $assignment->started_at?->toISOString(),
            'submitted_at' => $assignment->submitted_at?->toISOString(),
            'completed_at' => $assignment->completed_at?->toISOString(),
            'is_current_user' => $assignment->user_id === $currentUserId,
            'can_start' => $assignment->user_id === $currentUserId
                && $assignment->status === TaskAssignment::STATUS_PLANNED,
            'can_submit_report' => $assignment->user_id === $currentUserId
                && in_array($assignment->status, [
                    TaskAssignment::STATUS_IN_PROGRESS,
                    TaskAssignment::STATUS_NEEDS_REVISION,
                ], true),
        ];
    }

    private function reportPayload(Task $task, TaskReport $report): array
    {
        return [
            'id' => $report->id,
            'body' => $report->body,
            'status' => $report->status,
            'author' => $report->author,
            'reviewer' => $report->reviewer,
            'review_comment' => $report->review_comment,
            'reviewed_at' => $report->reviewed_at?->toISOString(),
            'created_at' => $report->created_at?->toISOString(),
            'attachments' => $report->attachments->map(
                fn (TaskReportAttachment $attachment) => [
                    'id' => $attachment->id,
                    'media_type' => $attachment->media_type,
                    'display_name' => $attachment->display_name,
                    'mime_type' => $attachment->mime_type,
                    'size' => $attachment->size,
                    'view_url' => route('tasks.report-attachments.view', [$task, $attachment]),
                    'download_url' => route('tasks.report-attachments.download', [$task, $attachment]),
                ],
            ),
        ];
    }
}
