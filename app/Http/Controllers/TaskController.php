<?php

namespace App\Http\Controllers;

use App\Http\Requests\TaskRequest;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use App\Services\TaskWorkflowService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->hasCrmAccess(), 403);
        $user = $request->user();

        $projects = Project::query()
            ->visibleTo($user)
            ->with(['manager:id,name,email', 'members:id,name,email'])
            ->orderBy('name')
            ->get()
            ->map(function (Project $project) use ($user) {
                $participants = collect([$project->manager])
                    ->merge($project->members)
                    ->unique('id')
                    ->values()
                    ->map->only(['id', 'name', 'email']);

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'division' => $project->division,
                    'manager' => $project->manager,
                    'participants' => $participants,
                    'can_manage' => $user->can('update', $project),
                ];
            });

        $tasks = Task::query()
            ->whereIn('project_id', $projects->pluck('id'))
            ->with([
                'project:id,name,division,manager_id',
                'assignee:id,name,email',
                'assignees:id,name,email,manager_id',
                'assignments.user:id,name,email',
                'creator:id,name',
                'comments.user:id,name',
            ])
            ->orderByRaw('due_date IS NULL, due_date')
            ->latest('id')
            ->get()
            ->map(fn (Task $task) => $this->taskPayload($task, $user));

        return Inertia::render('crm/planning', [
            'projects' => $projects,
            'tasks' => $tasks,
        ]);
    }

    public function division(Request $request, string $division): Response
    {
        $this->validateDivision($division);
        abort_unless($request->user()->hasCrmAccess(), 403);
        $user = $request->user();

        $tasks = Task::query()
            ->where('division', $division)
            ->visibleTo($user)
            ->with([
                'project:id,name,division,manager_id',
                'assignee:id,name,email,manager_id',
                'assignees:id,name,email,manager_id',
                'assignments.user:id,name,email',
                'creator:id,name',
                'comments.user:id,name',
            ])
            ->orderByRaw('due_date IS NULL, due_date')
            ->latest('id')
            ->get()
            ->map(fn (Task $task) => $this->taskPayload($task, $user));

        $projects = Project::query()
            ->where('division', $division)
            ->when(! $user->isAdministrator(), fn ($projects) => $projects->where('manager_id', $user->id))
            ->with(['manager:id,name,email', 'members:id,name,email'])
            ->orderBy('name')
            ->get()
            ->map(function (Project $project) {
                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'division' => $project->division,
                    'manager' => $project->manager,
                    'participants' => collect([$project->manager])
                        ->merge($project->members)
                        ->unique('id')
                        ->values()
                        ->map->only(['id', 'name', 'email']),
                    'can_manage' => true,
                ];
            });

        return Inertia::render('crm/division-tasks', [
            'division' => $division,
            'divisionLabel' => strtoupper($division),
            'projects' => $projects,
            'tasks' => $tasks,
            'assignees' => $this->availableAssignees($user),
            'canCreate' => $user->can('create', Task::class),
        ]);
    }

    public function store(TaskRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $project = $this->resolveProject($data['project_id'] ?? null);
        $assigneeIds = $this->assigneeIds($data);
        $errorField = array_key_exists('assignee_ids', $data) ? 'assignee_ids' : 'assignee_id';

        if ($project) {
            $this->authorize('create', [Task::class, $project]);
            $this->ensureAssigneesParticipate($project, $assigneeIds, $errorField);
            $division = $project->division;
        } else {
            $this->authorize('create', Task::class);
            $this->ensureStandaloneAssigneesAllowed($request->user(), $assigneeIds, $errorField);
            $division = $data['division'];
        }

        unset($data['assignee_ids']);
        unset($data['status']);
        $task = Task::create([
            ...$data,
            'project_id' => $project?->id,
            'division' => $division,
            'assignee_id' => $assigneeIds->first(),
            'creator_id' => $request->user()->id,
            'status' => TaskAssignment::STATUS_PLANNED,
        ]);
        $task->assignees()->sync($assigneeIds);

        return back()->with('success', 'Задача создана.');
    }

    public function update(TaskRequest $request, Task $task): RedirectResponse
    {
        $task->load(['project', 'assignee', 'assignees']);
        $this->authorize('update', $task);
        $data = $request->validated();
        $project = $this->resolveProject($data['project_id'] ?? null);
        $assigneeIds = $this->assigneeIds($data);
        $errorField = array_key_exists('assignee_ids', $data) ? 'assignee_ids' : 'assignee_id';

        if ($project) {
            $this->authorize('create', [Task::class, $project]);
            $this->ensureAssigneesParticipate($project, $assigneeIds, $errorField);
            $division = $project->division;
        } else {
            $this->authorize('create', Task::class);
            $this->ensureStandaloneAssigneesAllowed($request->user(), $assigneeIds, $errorField);
            $division = $data['division'] ?? $task->division;
        }

        $this->ensureActiveAssigneesAreKept($task, $assigneeIds, $errorField);
        unset($data['assignee_ids']);
        unset($data['status']);
        $task->update([
            ...$data,
            'project_id' => $project?->id,
            'division' => $division,
            'assignee_id' => $assigneeIds->first(),
        ]);
        $task->assignees()->sync($assigneeIds);
        app(TaskWorkflowService::class)->refreshTaskStatus($task);

        return back()->with('success', 'Задача обновлена.');
    }

    public function updateStatus(
        Request $request,
        Task $task,
        TaskWorkflowService $workflow,
    ): RedirectResponse {
        $task->load(['project', 'assignee', 'assignees']);
        $this->authorize('changeStatus', $task);
        $request->validate([
            'status' => ['required', Rule::in([TaskAssignment::STATUS_IN_PROGRESS])],
        ]);
        $workflow->start($task, $request->user());

        return back()->with('success', 'Задача взята в работу.');
    }

    public function comment(Request $request, Task $task): RedirectResponse
    {
        $task->load(['project', 'assignee', 'assignees']);
        $this->authorize('comment', $task);
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);
        $task->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $validated['body'],
        ]);

        return back()->with('success', 'Комментарий добавлен.');
    }

    public function destroy(Task $task): RedirectResponse
    {
        $task->load(['project', 'assignee', 'assignees']);
        $this->authorize('delete', $task);
        $task->delete();

        return back()->with('success', 'Задача удалена.');
    }

    private function ensureAssigneesParticipate(Project $project, Collection $assigneeIds, string $errorField): void
    {
        $allowedIds = $project->members->pluck('id')->push($project->manager_id);

        if ($assigneeIds->diff($allowedIds)->isNotEmpty()) {
            throw ValidationException::withMessages([
                $errorField => 'Все исполнители должны быть участниками проекта.',
            ]);
        }
    }

    private function ensureStandaloneAssigneesAllowed(User $user, Collection $assigneeIds, string $errorField): void
    {
        $allowedIds = $this->availableAssignees($user)->pluck('id');

        if ($assigneeIds->diff($allowedIds)->isNotEmpty()) {
            throw ValidationException::withMessages([
                $errorField => 'Одному или нескольким пользователям нельзя назначить задачу.',
            ]);
        }
    }

    private function ensureActiveAssigneesAreKept(
        Task $task,
        Collection $assigneeIds,
        string $errorField,
    ): void {
        $protectedAssigneeIds = $task->assignments()
            ->where(function ($assignments) {
                $assignments
                    ->where('status', '!=', TaskAssignment::STATUS_PLANNED)
                    ->orWhereHas('reports');
            })
            ->pluck('user_id');

        if ($protectedAssigneeIds->diff($assigneeIds)->isNotEmpty()) {
            throw ValidationException::withMessages([
                $errorField => 'Нельзя удалить исполнителя, который уже начал работу или сдавал отчёт.',
            ]);
        }
    }

    private function assigneeIds(array $data): Collection
    {
        return collect($data['assignee_ids'] ?? [$data['assignee_id'] ?? null])
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    private function availableAssignees(User $user): Collection
    {
        $users = User::query()
            ->with('roles:id,name')
            ->whereHas('roles', fn ($roles) => $roles->whereIn('name', [
                'Администратор',
                'Руководитель',
                'Сотрудник',
                'Бухгалтер',
                'Консультант',
            ]));

        if (! $user->isAdministrator()) {
            $users->where(function ($assignees) use ($user) {
                $assignees
                    ->whereKey($user->id)
                    ->orWhere('manager_id', $user->id)
                    ->orWhereHas('roles', fn ($roles) => $roles->where('name', 'Консультант'));
            });
        }

        return $users
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'manager_id'])
            ->map(fn (User $assignee) => [
                'id' => $assignee->id,
                'name' => $assignee->name,
                'email' => $assignee->email,
                'roles' => $assignee->roles->pluck('name')->values(),
            ]);
    }

    private function resolveProject(?int $projectId): ?Project
    {
        return $projectId
            ? Project::with(['manager', 'members'])->findOrFail($projectId)
            : null;
    }

    private function validateDivision(string $division): void
    {
        abort_unless(in_array($division, Project::DIVISIONS, true), 404);
    }

    private function taskPayload(Task $task, User $user): array
    {
        $assignments = $task->assignments->map(fn (TaskAssignment $assignment) => [
            'id' => $assignment->id,
            'user_id' => $assignment->user_id,
            'user' => $assignment->user,
            'status' => $assignment->status,
            'started_at' => $assignment->started_at?->toISOString(),
            'submitted_at' => $assignment->submitted_at?->toISOString(),
            'completed_at' => $assignment->completed_at?->toISOString(),
            'is_current_user' => $assignment->user_id === $user->id,
            'can_start' => $assignment->user_id === $user->id
                && $assignment->status === TaskAssignment::STATUS_PLANNED,
            'can_submit_report' => $assignment->user_id === $user->id
                && in_array($assignment->status, [
                    TaskAssignment::STATUS_IN_PROGRESS,
                    TaskAssignment::STATUS_NEEDS_REVISION,
                ], true),
        ])->values();

        return [
            ...$task->toArray(),
            'assignments' => $assignments,
            'assignments_count' => $assignments->count(),
            'accepted_reports_count' => $assignments
                ->where('status', TaskAssignment::STATUS_DONE)
                ->count(),
            'can_manage' => $user->can('update', $task),
            'can_change_status' => false,
            'can_review_reports' => $user->can('reviewReports', $task),
            'can_comment' => $user->can('comment', $task),
        ];
    }
}
