<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Client extends Model
{
    use HasFactory;

    public const DIVISIONS = ['jvm', 'ptl', 'wap'];

    protected $fillable = [
        'company_name',
        'division',
        'bin',
        'contact_name',
        'position',
        'phone',
        'email',
        'address',
        'status',
        'notes',
        'created_by',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
