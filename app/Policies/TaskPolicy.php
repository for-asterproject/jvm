<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    public function view(User $user, Task $task): bool
    {
        return $user->can('view', $task->project);
    }

    public function create(User $user, Project $project): bool
    {
        return $user->isAdministrator() || $project->manager_id === $user->id;
    }

    public function update(User $user, Task $task): bool
    {
        return $user->isAdministrator() || $task->project->manager_id === $user->id;
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
