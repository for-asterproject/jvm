<?php

namespace App\Http\Controllers;

use App\Http\Requests\TaskRequest;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

    public function store(TaskRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $project = Project::with(['manager', 'members'])->findOrFail($data['project_id']);
        $this->authorize('create', [Task::class, $project]);
        $this->ensureAssigneeParticipates($project, (int) $data['assignee_id']);

        Task::create([
            ...$data,
            'creator_id' => $request->user()->id,
        ]);

        return back()->with('success', 'Задача создана.');
    }

    public function update(TaskRequest $request, Task $task): RedirectResponse
    {
        $task->load('project');
        $this->authorize('update', $task);
        $data = $request->validated();
        $project = Project::with(['manager', 'members'])->findOrFail($data['project_id']);
        $this->authorize('create', [Task::class, $project]);
        $this->ensureAssigneeParticipates($project, (int) $data['assignee_id']);

        $task->update($data);

        return back()->with('success', 'Задача обновлена.');
    }

    public function updateStatus(Request $request, Task $task): RedirectResponse
    {
        $task->load('project');
        $this->authorize('changeStatus', $task);
        $validated = $request->validate([
            'status' => ['required', Rule::in(Task::STATUSES)],
        ]);
        $task->update($validated);

        return back()->with('success', 'Статус задачи изменён.');
    }

    public function comment(Request $request, Task $task): RedirectResponse
    {
        $task->load('project');
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
        $task->load('project');
        $this->authorize('delete', $task);
        $task->delete();

        return back()->with('success', 'Задача удалена.');
    }

    private function ensureAssigneeParticipates(Project $project, int $assigneeId): void
    {
        $allowed = $project->manager_id === $assigneeId
            || $project->members->contains('id', $assigneeId);

        if (! $allowed) {
            throw ValidationException::withMessages([
                'assignee_id' => 'Исполнитель должен быть участником проекта.',
            ]);
        }
    }

    private function taskPayload(Task $task, $user): array
    {
        return [
            ...$task->toArray(),
            'can_manage' => $user->can('update', $task),
            'can_change_status' => $user->can('changeStatus', $task),
            'can_comment' => $user->can('comment', $task),
        ];
    }
}
