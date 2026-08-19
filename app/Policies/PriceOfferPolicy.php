<?php

namespace App\Policies;

use App\Models\PriceOffer;
use App\Models\User;

class PriceOfferPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isStaff();
    }

    public function view(User $user, PriceOffer $priceOffer): bool
    {
        return $user->isStaff();
    }

    public function create(User $user): bool
    {
        return $user->isStaff();
    }

    public function update(User $user, PriceOffer $priceOffer): bool
    {
        return $user->isStaff();
    }

    public function delete(User $user, PriceOffer $priceOffer): bool
    {
        return $user->isAdministrator() || $priceOffer->created_by === $user->id;
    }
}
