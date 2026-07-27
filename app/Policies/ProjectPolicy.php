<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasCrmAccess();
    }

    public function view(User $user, Project $project): bool
    {
        return $user->isAdministrator()
            || $project->manager_id === $user->id
            || $project->members()->whereKey($user->id)->exists();
    }

    public function create(User $user): bool
    {
        return $user->isAdministrator() || $user->isManager();
    }

    public function update(User $user, Project $project): bool
    {
        return $user->isAdministrator() || $project->manager_id === $user->id;
    }

    public function delete(User $user, Project $project): bool
    {
        return $this->update($user, $project);
    }
}
