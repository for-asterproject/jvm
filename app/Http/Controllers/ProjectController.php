<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectRequest;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(string $division): Response
    {
        $this->validateDivision($division);
        $this->authorize('viewAny', Project::class);
        $user = request()->user();

        $projects = Project::query()
            ->where('division', $division)
            ->visibleTo($user)
            ->with(['manager:id,name,email', 'members:id,name,email'])
            ->withCount('tasks')
            ->latest()
            ->get()
            ->map(fn (Project $project) => [
                ...$project->toArray(),
                'can_manage' => $user->can('update', $project),
            ]);

        return Inertia::render('crm/projects', [
            'division' => $division,
            'divisionLabel' => strtoupper($division),
            'projects' => $projects,
            'managers' => $this->availableManagers($user),
            'availableMembers' => $this->availableMembers($user),
            'canCreate' => $user->can('create', Project::class),
        ]);
    }

    public function store(ProjectRequest $request, string $division): RedirectResponse
    {
        $this->validateDivision($division);
        $this->authorize('create', Project::class);

        $data = $request->validated();
        $managerId = $this->resolveManagerId($request->user(), $data['manager_id'] ?? null);
        $memberIds = collect($data['member_ids'] ?? [])->reject(fn ($id) => (int) $id === $managerId);
        $this->validateMemberIds($request->user(), $memberIds);

        unset($data['member_ids']);
        $project = Project::create([
            ...$data,
            'division' => $division,
            'manager_id' => $managerId,
        ]);
        $project->members()->sync($memberIds->all());

        return back()->with('success', 'Проект создан.');
    }

    public function update(
        ProjectRequest $request,
        string $division,
        Project $project,
    ): RedirectResponse {
        $this->ensureProjectDivision($project, $division);
        $this->authorize('update', $project);

        $data = $request->validated();
        $managerId = $this->resolveManagerId($request->user(), $data['manager_id'] ?? $project->manager_id);
        $memberIds = collect($data['member_ids'] ?? [])->reject(fn ($id) => (int) $id === $managerId);
        $this->validateMemberIds($request->user(), $memberIds);

        unset($data['member_ids']);
        $project->update([
            ...$data,
            'manager_id' => $managerId,
        ]);
        $project->members()->sync($memberIds->all());

        return back()->with('success', 'Проект обновлён.');
    }

    public function destroy(string $division, Project $project): RedirectResponse
    {
        $this->ensureProjectDivision($project, $division);
        $this->authorize('delete', $project);
        $project->delete();

        return back()->with('success', 'Проект удалён.');
    }

    private function validateDivision(string $division): void
    {
        abort_unless(in_array($division, Project::DIVISIONS, true), 404);
    }

    private function ensureProjectDivision(Project $project, string $division): void
    {
        $this->validateDivision($division);
        abort_unless($project->division === $division, 404);
    }

    private function resolveManagerId(User $user, ?int $requestedManagerId): int
    {
        if (! $user->isAdministrator()) {
            return $user->id;
        }

        $managerId = $requestedManagerId ?: $user->id;
        $manager = User::with('roles')->findOrFail($managerId);

        if (! ($manager->isAdministrator() || $manager->isManager())) {
            throw ValidationException::withMessages([
                'manager_id' => 'Руководителем проекта может быть администратор или пользователь с ролью «Руководитель».',
            ]);
        }

        return $managerId;
    }

    private function validateMemberIds(User $user, Collection $memberIds): void
    {
        $invalid = $memberIds->diff($this->eligibleMemberIds($user));

        if ($invalid->isNotEmpty()) {
            throw ValidationException::withMessages([
                'member_ids' => 'Выбран пользователь, которого нельзя добавить в команду.',
            ]);
        }
    }

    private function eligibleMemberIds(User $user): Collection
    {
        $query = User::query()->whereKeyNot($user->id);

        if ($user->isAdministrator()) {
            return $query
                ->whereHas('roles', fn ($roles) => $roles->whereIn('name', [
                    'Администратор',
                    'Руководитель',
                    'Сотрудник',
                    'Бухгалтер',
                    'Консультант',
                ]))
                ->pluck('id');
        }

        return $query
            ->where(function ($users) use ($user) {
                $users
                    ->where('manager_id', $user->id)
                    ->orWhereHas('roles', fn ($roles) => $roles->where('name', 'Консультант'));
            })
            ->pluck('id');
    }

    private function availableManagers(User $user): Collection
    {
        if (! $user->isAdministrator()) {
            return collect([[
                'id' => $user->id,
                'name' => $user->name,
            ]]);
        }

        return User::query()
            ->whereHas('roles', fn ($roles) => $roles->whereIn('name', ['Администратор', 'Руководитель']))
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    private function availableMembers(User $user): Collection
    {
        return User::query()
            ->with('roles:id,name')
            ->whereIn('id', $this->eligibleMemberIds($user))
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'roles' => $member->roles->pluck('name')->values(),
            ]);
    }
}
