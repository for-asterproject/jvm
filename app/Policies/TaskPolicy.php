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
            || $task->assignee_id === $user->id
            || $task->creator_id === $user->id) {
            return true;
        }

        if ($task->project && $user->can('view', $task->project)) {
            return true;
        }

        return $user->isManager() && $task->assignee?->manager_id === $user->id;
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
            && ($task->creator_id === $user->id || $task->assignee?->manager_id === $user->id);
    }

    public function delete(User $user, Task $task): bool
    {
        return $this->update($user, $task);
    }

    public function changeStatus(User $user, Task $task): bool
    {
        return $this->update($user, $task) || $task->assignee_id === $user->id;
    }

    public function comment(User $user, Task $task): bool
    {
        return $this->update($user, $task) || $task->assignee_id === $user->id;
    }
}
