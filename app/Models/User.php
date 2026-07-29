<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'manager_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_id');
    }

    public function directReports(): HasMany
    {
        return $this->hasMany(self::class, 'manager_id');
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class)->withTimestamps();
    }

    public function managedProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'manager_id');
    }

    public function assignedTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assignee_id');
    }

    public function collaborativeTasks(): BelongsToMany
    {
        return $this->belongsToMany(Task::class)
            ->using(TaskAssignment::class)
            ->as('assignment')
            ->withPivot([
                'id',
                'status',
                'started_at',
                'submitted_at',
                'completed_at',
            ])
            ->withTimestamps();
    }

    public function hasRole(string ...$roles): bool
    {
        $roleNames = $this->relationLoaded('roles')
            ? $this->roles->pluck('name')
            : $this->roles()->pluck('name');

        return $roleNames->intersect($roles)->isNotEmpty();
    }

    public function isAdministrator(): bool
    {
        return $this->hasRole('Администратор');
    }

    public function isManager(): bool
    {
        return $this->hasRole('Руководитель');
    }

    public function isConsultant(): bool
    {
        return $this->hasRole('Консультант');
    }

    public function isStaff(): bool
    {
        return $this->hasRole('Администратор', 'Руководитель', 'Сотрудник', 'Бухгалтер');
    }

    public function hasCrmAccess(): bool
    {
        return $this->isStaff() || $this->isConsultant();
    }
}
