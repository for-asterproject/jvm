<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'factory_price', 'markup_percentage', 'agent_bonus', 'is_service'];
    protected $casts = [
        'factory_price' => 'double',
        'markup_percentage' => 'double',
        'agent_bonus' => 'double',
        'is_service' => 'boolean',
    ];
}
