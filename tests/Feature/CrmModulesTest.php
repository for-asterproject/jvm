<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Presentation;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CrmModulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_manage_clients_and_consultant_cannot_access_them(): void
    {
        $employee = $this->userWithRole('Сотрудник');
        $consultant = $this->userWithRole('Консультант');

        $this->actingAs($employee)->post('/clients', [
            'company_name' => 'Aster Client',
            'bin' => '123456789012',
            'contact_name' => 'Алия',
            'position' => 'Директор',
            'phone' => '+7 700 000 00 00',
            'email' => 'client@example.com',
            'address' => 'Алматы',
            'status' => 'active',
            'notes' => 'Важный клиент',
        ])->assertRedirect();

        $client = Client::firstOrFail();
        $this->assertSame($employee->id, $client->created_by);
        $this->actingAs($employee)->put("/clients/{$client->id}", [
            'company_name' => 'Aster Client Updated',
            'bin' => '123456789012',
            'status' => 'inactive',
        ])->assertRedirect();
        $this->assertDatabaseHas('clients', [
            'id' => $client->id,
            'company_name' => 'Aster Client Updated',
            'status' => 'inactive',
        ]);

        $this->actingAs($consultant)->get('/clients')->assertForbidden();
        $this->actingAs($consultant)->delete("/clients/{$client->id}")->assertForbidden();
    }

    public function test_staff_can_upload_presentations_and_consultant_has_read_only_access(): void
    {
        Storage::fake('local');
        $employee = $this->userWithRole('Сотрудник');
        $consultant = $this->userWithRole('Консультант');

        $this->actingAs($employee)->post('/presentations', [
            'title' => 'Презентация JVM',
            'description' => 'Для клиентов',
            'source_type' => 'file',
            'file' => UploadedFile::fake()->create('jvm.pdf', 512, 'application/pdf'),
        ])->assertRedirect();

        $presentation = Presentation::firstOrFail();
        Storage::disk('local')->assertExists($presentation->path);

        $this->actingAs($consultant)->get('/presentations')->assertOk();
        $this->actingAs($consultant)
            ->get("/presentations/{$presentation->id}/download")
            ->assertDownload('jvm.pdf');
        $this->actingAs($consultant)->post('/presentations', [
            'title' => 'Запрещено',
            'source_type' => 'link',
            'url' => 'https://example.com',
        ])->assertForbidden();
    }

    public function test_presentation_file_type_and_size_are_validated(): void
    {
        Storage::fake('local');
        $employee = $this->userWithRole('Сотрудник');

        $this->actingAs($employee)->post('/presentations', [
            'title' => 'Опасный файл',
            'source_type' => 'file',
            'file' => UploadedFile::fake()->create('payload.exe', 100, 'application/octet-stream'),
        ])->assertSessionHasErrors('file');

        $this->actingAs($employee)->post('/presentations', [
            'title' => 'Большой файл',
            'source_type' => 'file',
            'file' => UploadedFile::fake()->create('large.pdf', 26 * 1024, 'application/pdf'),
        ])->assertSessionHasErrors('file');
    }

    public function test_project_visibility_is_limited_to_manager_and_assigned_members(): void
    {
        $manager = $this->userWithRole('Руководитель');
        $employee = $this->userWithRole('Сотрудник', $manager);
        $consultant = $this->userWithRole('Консультант');
        $outsider = $this->userWithRole('Сотрудник');

        $this->actingAs($manager)->post('/projects/jvm', $this->projectPayload([
            'member_ids' => [$employee->id, $consultant->id],
        ]))->assertRedirect();

        $project = Project::firstOrFail();
        $this->assertSame('jvm', $project->division);
        $this->assertEqualsCanonicalizing(
            [$employee->id, $consultant->id],
            $project->members()->pluck('users.id')->all(),
        );

        $this->actingAs($consultant)
            ->get('/projects/jvm')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('crm/projects')
                ->has('projects', 1));

        $this->actingAs($outsider)
            ->get('/projects/jvm')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('projects', 0));
    }

    public function test_manager_can_only_add_direct_reports_and_consultants_to_project(): void
    {
        $manager = $this->userWithRole('Руководитель');
        $otherManager = $this->userWithRole('Руководитель');
        $otherEmployee = $this->userWithRole('Сотрудник', $otherManager);

        $this->actingAs($manager)->post('/projects/ptl', $this->projectPayload([
            'member_ids' => [$otherEmployee->id],
        ]))->assertSessionHasErrors('member_ids');

        $this->assertDatabaseCount('projects', 0);
    }

    public function test_task_assignee_must_participate_and_only_assignee_can_change_status(): void
    {
        $manager = $this->userWithRole('Руководитель');
        $employee = $this->userWithRole('Сотрудник', $manager);
        $consultant = $this->userWithRole('Консультант');
        $outsider = $this->userWithRole('Сотрудник');
        $project = Project::create([
            ...$this->projectPayload(),
            'division' => 'wap',
            'manager_id' => $manager->id,
        ]);
        $project->members()->attach([$employee->id, $consultant->id]);

        $this->actingAs($manager)->post('/tasks', $this->taskPayload($project, $outsider))
            ->assertSessionHasErrors('assignee_id');

        $this->actingAs($manager)->post('/tasks', $this->taskPayload($project, $employee))
            ->assertRedirect();
        $task = Task::firstOrFail();

        $this->actingAs($employee)->patch("/tasks/{$task->id}/status", [
            'status' => 'in_progress',
        ])->assertRedirect();
        $this->assertSame('in_progress', $task->fresh()->status);

        $this->actingAs($employee)->post("/tasks/{$task->id}/comments", [
            'body' => 'Задача принята в работу.',
        ])->assertRedirect();
        $this->assertDatabaseHas('task_comments', [
            'task_id' => $task->id,
            'user_id' => $employee->id,
        ]);

        $this->actingAs($consultant)->patch("/tasks/{$task->id}/status", [
            'status' => 'done',
        ])->assertForbidden();
        $this->actingAs($outsider)->get('/planning')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('tasks', 0));
    }

    public function test_employee_cannot_edit_task_content_but_project_manager_can(): void
    {
        $manager = $this->userWithRole('Руководитель');
        $employee = $this->userWithRole('Сотрудник', $manager);
        $project = Project::create([
            ...$this->projectPayload(),
            'division' => 'jvm',
            'manager_id' => $manager->id,
        ]);
        $project->members()->attach($employee);
        $task = Task::create([
            ...$this->taskPayload($project, $employee),
            'creator_id' => $manager->id,
        ]);

        $payload = $this->taskPayload($project, $employee, ['title' => 'Изменённая задача']);
        $this->actingAs($employee)->put("/tasks/{$task->id}", $payload)->assertForbidden();
        $this->actingAs($manager)->put("/tasks/{$task->id}", $payload)->assertRedirect();
        $this->assertSame('Изменённая задача', $task->fresh()->title);
    }

    public function test_only_administrator_can_use_role_and_manager_administration(): void
    {
        $administrator = $this->userWithRole('Администратор');
        $manager = $this->userWithRole('Руководитель');
        $employee = $this->userWithRole('Сотрудник');

        $this->actingAs($employee)->get('/adminpanel')->assertForbidden();
        $this->actingAs($administrator)->get('/adminpanel')->assertOk();
        $this->actingAs($administrator)->put("/users/{$employee->id}/manager", [
            'manager_id' => $manager->id,
        ])->assertOk();
        $this->assertSame($manager->id, $employee->fresh()->manager_id);
    }

    public function test_user_with_active_projects_or_tasks_cannot_be_deleted(): void
    {
        $administrator = $this->userWithRole('Администратор');
        $manager = $this->userWithRole('Руководитель');
        Project::create([
            ...$this->projectPayload(),
            'division' => 'jvm',
            'manager_id' => $manager->id,
        ]);

        $this->actingAs($administrator)
            ->delete("/users/{$manager->id}")
            ->assertUnprocessable()
            ->assertJson([
                'message' => 'Сначала переназначьте проекты и задачи этого пользователя.',
            ]);
        $this->assertDatabaseHas('users', ['id' => $manager->id]);
    }

    public function test_new_users_receive_an_initial_system_role(): void
    {
        $this->post('/register', [
            'name' => 'Первый пользователь',
            'email' => 'first@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertRedirect('/dashboard');
        $this->assertTrue(User::where('email', 'first@example.com')->firstOrFail()->isAdministrator());

        $this->post('/logout');
        $this->post('/register', [
            'name' => 'Второй пользователь',
            'email' => 'second@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertRedirect('/dashboard');
        $this->assertTrue(User::where('email', 'second@example.com')->firstOrFail()->hasRole('Сотрудник'));
    }

    private function userWithRole(string $roleName, ?User $manager = null): User
    {
        $user = User::factory()->create(['manager_id' => $manager?->id]);
        $user->roles()->attach(Role::firstOrCreate(['name' => $roleName]));

        return $user->load('roles');
    }

    private function projectPayload(array $overrides = []): array
    {
        return [
            'name' => 'Новый проект',
            'client_name' => 'Тестовый клиент',
            'description' => 'Описание проекта',
            'status' => 'new',
            'priority' => 'normal',
            'start_date' => '2026-08-01',
            'due_date' => '2026-09-01',
            'budget' => 100000,
            'budget_currency' => 'KZT',
            'notes' => 'Заметки',
            'member_ids' => [],
            ...$overrides,
        ];
    }

    private function taskPayload(Project $project, User $assignee, array $overrides = []): array
    {
        return [
            'project_id' => $project->id,
            'title' => 'Подготовить документы',
            'description' => 'Описание задачи',
            'status' => 'planned',
            'priority' => 'normal',
            'assignee_id' => $assignee->id,
            'due_date' => '2026-08-15',
            ...$overrides,
        ];
    }
}
