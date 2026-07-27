<?php

namespace App\Policies;

use App\Models\Client;
use App\Models\User;

class ClientPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isStaff();
    }

    public function view(User $user, Client $client): bool
    {
        return $user->isStaff();
    }

    public function create(User $user): bool
    {
        return $user->isStaff();
    }

    public function update(User $user, Client $client): bool
    {
        return $user->isStaff();
    }

    public function delete(User $user, Client $client): bool
    {
        return $user->isStaff();
    }
}
