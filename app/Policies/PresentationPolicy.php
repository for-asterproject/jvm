<?php

namespace App\Policies;

use App\Models\Presentation;
use App\Models\User;

class PresentationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasCrmAccess();
    }

    public function view(User $user, Presentation $presentation): bool
    {
        return $user->hasCrmAccess();
    }

    public function create(User $user): bool
    {
        return $user->isStaff();
    }

    public function update(User $user, Presentation $presentation): bool
    {
        return $user->isStaff();
    }

    public function delete(User $user, Presentation $presentation): bool
    {
        return $user->isStaff();
    }
}
