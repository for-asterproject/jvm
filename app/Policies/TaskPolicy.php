<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    public function view(User $user, Task $task): bool
    {
        if ($user->isAdministrator()
            || $this->isAssignee($user, $task)
            || $task->creator_id === $user->id) {
            return true;
        }

        if ($task->project && $user->can('view', $task->project)) {
            return true;
        }

        return $user->isManager() && $this->managesAssignee($user, $task);
    }

    public function create(User $user, ?Project $project = null): bool
    {
        if (! ($user->isAdministrator() || $user->isManager())) {
            return false;
        }

        return ! $project || $user->isAdministrator() || $project->manager_id === $user->id;
    }

    public function update(User $user, Task $task): bool
    {
        if ($user->isAdministrator()) {
            return true;
        }

        if ($task->project) {
            return $task->project->manager_id === $user->id;
        }

        return $user->isManager()
            && ($task->creator_id === $user->id || $this->managesAssignee($user, $task));
    }

    public function delete(User $user, Task $task): bool
    {
        return $this->update($user, $task);
    }

    public function changeStatus(User $user, Task $task): bool
    {
        return $this->work($user, $task);
    }

    public function work(User $user, Task $task): bool
    {
        return $this->isAssignee($user, $task);
    }

    public function reviewReports(User $user, Task $task): bool
    {
        return $user->isAdministrator() || $task->creator_id === $user->id;
    }

    public function comment(User $user, Task $task): bool
    {
        return $this->update($user, $task) || $this->isAssignee($user, $task);
    }

    private function isAssignee(User $user, Task $task): bool
    {
        if ($task->relationLoaded('assignees')) {
            return $task->assignee_id === $user->id
                || $task->assignees->contains('id', $user->id);
        }

        return $task->assignee_id === $user->id
            || $task->assignees()->whereKey($user->id)->exists();
    }

    private function managesAssignee(User $user, Task $task): bool
    {
        if ($task->relationLoaded('assignees')) {
            return $task->assignee?->manager_id === $user->id
                || $task->assignees->contains('manager_id', $user->id);
        }

        return $task->assignees()->where('manager_id', $user->id)->exists();
    }
}
