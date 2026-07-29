<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Presentation;
use App\Models\PresentationAttachment;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CrmModulesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

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

    public function test_staff_can_manage_presentation_collections_and_consultant_has_read_only_access(): void
    {
        $employee = $this->userWithRole('Сотрудник');
        $consultant = $this->userWithRole('Консультант');

        $this->actingAs($employee)->post('/presentations', [
            'title' => 'Презентация JVM',
            'description' => 'Для клиентов',
        ])->assertRedirect();

        $presentation = Presentation::firstOrFail();
        $this->assertSame('collection', $presentation->source_type);

        $this->actingAs($employee)->post(
            "/presentations/{$presentation->id}/attachments/links",
            [
                'display_name' => 'Видео JVM',
                'url' => 'https://example.com/jvm',
            ],
        )->assertRedirect();
        $this->assertDatabaseHas('presentation_attachments', [
            'presentation_id' => $presentation->id,
            'kind' => 'link',
            'display_name' => 'Видео JVM',
        ]);

        $this->actingAs($consultant)->get('/presentations')->assertOk();
        $this->actingAs($consultant)
            ->get("/presentations/{$presentation->id}")
            ->assertOk();
        $this->actingAs($consultant)
            ->post("/presentations/{$presentation->id}/attachments/links", [
                'display_name' => 'Запрещено',
                'url' => 'https://example.com',
            ])
            ->assertForbidden();
        $this->actingAs($consultant)
            ->postJson("/presentations/{$presentation->id}/uploads", [
                'name' => 'forbidden.pdf',
                'size' => 1024,
                'mime_type' => 'application/pdf',
            ])
            ->assertForbidden();
    }

    public function test_presentation_chunked_upload_is_validated_completed_and_private(): void
    {
        config(['presentations.chunk_size' => 4]);
        $employee = $this->userWithRole('Сотрудник');
        $consultant = $this->userWithRole('Консультант');
        $presentation = Presentation::create([
            'title' => 'JVM',
            'source_type' => 'collection',
            'uploaded_by' => $employee->id,
        ]);

        $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads", [
                'name' => 'payload.exe',
                'size' => 100,
                'mime_type' => 'application/octet-stream',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads", [
                'name' => 'large.pdf',
                'size' => config('presentations.max_file_size') + 1,
                'mime_type' => 'application/pdf',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('size');

        $response = $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads", [
                'name' => 'jvm.pdf',
                'size' => 8,
                'mime_type' => 'application/pdf',
                'last_modified' => 123,
            ])
            ->assertOk()
            ->assertJsonPath('chunk_size', 4)
            ->assertJsonPath('total_chunks', 2)
            ->assertJsonPath('uploaded_chunks', []);

        $attachment = PresentationAttachment::firstOrFail();
        $this->putChunk(
            $employee,
            "/presentations/{$presentation->id}/uploads/{$attachment->id}/chunks/0",
            'ABCD',
        )->assertOk();

        $this->actingAs($employee)
            ->postJson(
                "/presentations/{$presentation->id}/uploads/{$attachment->id}/complete",
            )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');

        $this->putChunk(
            $employee,
            "/presentations/{$presentation->id}/uploads/{$attachment->id}/chunks/1",
            'XYZ',
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('chunk');

        $this->putChunk(
            $employee,
            "/presentations/{$presentation->id}/uploads/{$attachment->id}/chunks/1",
            'EFGH',
        )->assertOk();

        $this->actingAs($employee)
            ->postJson(
                "/presentations/{$presentation->id}/uploads/{$attachment->id}/complete",
            )
            ->assertOk();

        $this->assertSame(
            PresentationAttachment::STATUS_READY,
            $attachment->fresh()->status,
        );
        $this->assertSame($attachment->id, $response->json('attachment_id'));
        Storage::disk('local')->assertExists($attachment->path);
        $this->assertSame('ABCDEFGH', Storage::disk('local')->get($attachment->path));
        $this->actingAs($consultant)
            ->get("/presentations/{$presentation->id}/attachments/{$attachment->id}/view")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
        $this->actingAs($consultant)
            ->withHeader('Range', 'bytes=0-3')
            ->get("/presentations/{$presentation->id}/attachments/{$attachment->id}/view")
            ->assertStatus(206)
            ->assertHeader('content-range', 'bytes 0-3/8');
    }

    public function test_chunked_upload_can_resume_and_enforces_presentation_quotas(): void
    {
        config(['presentations.chunk_size' => 4]);
        $employee = $this->userWithRole('Сотрудник');
        $presentation = Presentation::create([
            'title' => 'Большая презентация',
            'source_type' => 'collection',
            'uploaded_by' => $employee->id,
        ]);
        $payload = [
            'name' => 'video.mp4',
            'size' => 8,
            'mime_type' => 'video/mp4',
            'last_modified' => 456,
        ];

        $first = $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads", $payload)
            ->assertOk();

        $attachment = PresentationAttachment::firstOrFail();
        $this->putChunk(
            $employee,
            "/presentations/{$presentation->id}/uploads/{$attachment->id}/chunks/0",
            'ABCD',
        )->assertOk();
        $second = $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads", $payload)
            ->assertOk()
            ->assertJsonPath('uploaded_chunks', [0]);

        $this->assertSame($first->json('attachment_id'), $second->json('attachment_id'));
        $this->assertDatabaseCount('presentation_attachments', 1);
        $this->putChunk(
            $employee,
            "/presentations/{$presentation->id}/uploads/{$attachment->id}/chunks/1",
            'EFGH',
        )->assertOk();
        $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads/{$attachment->id}/complete")
            ->assertOk();

        foreach (range(1, config('presentations.max_attachments') - 1) as $index) {
            $presentation->attachments()->create([
                'presentation_id' => $presentation->id,
                'uploaded_by' => $employee->id,
                'kind' => 'link',
                'media_type' => 'link',
                'display_name' => "Ссылка {$index}",
                'url' => "https://example.com/{$index}",
                'status' => 'ready',
                'size' => 0,
            ]);
        }

        $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads", [
                'name' => 'extra.pdf',
                'size' => 1024,
                'mime_type' => 'application/pdf',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('attachments');
    }

    public function test_presentation_upload_enforces_total_size_quota(): void
    {
        $employee = $this->userWithRole('Сотрудник');
        $presentation = Presentation::create([
            'title' => 'Заполненная презентация',
            'source_type' => 'collection',
            'uploaded_by' => $employee->id,
        ]);
        $presentation->attachments()->create([
            'uploaded_by' => $employee->id,
            'kind' => 'file',
            'media_type' => 'video',
            'display_name' => 'existing.mp4',
            'size' => config('presentations.max_total_size'),
            'status' => 'ready',
        ]);

        $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads", [
                'name' => 'extra.pdf',
                'size' => 1,
                'mime_type' => 'application/pdf',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('size');
    }

    public function test_expired_chunked_uploads_are_cleaned_from_server(): void
    {
        config(['presentations.chunk_size' => 4]);
        $employee = $this->userWithRole('Сотрудник');
        $presentation = Presentation::create([
            'title' => 'Незавершённая презентация',
            'source_type' => 'collection',
            'uploaded_by' => $employee->id,
        ]);
        $response = $this->actingAs($employee)
            ->postJson("/presentations/{$presentation->id}/uploads", [
                'name' => 'draft.pdf',
                'size' => 4,
                'mime_type' => 'application/pdf',
            ])
            ->assertOk();
        $attachment = PresentationAttachment::findOrFail(
            $response->json('attachment_id'),
        );
        $this->putChunk(
            $employee,
            "/presentations/{$presentation->id}/uploads/{$attachment->id}/chunks/0",
            'ABCD',
        )->assertOk();
        $attachment->update(['expires_at' => now()->subMinute()]);

        $this->artisan('presentations:cleanup-uploads')->assertSuccessful();

        $this->assertSame(
            PresentationAttachment::STATUS_FAILED,
            $attachment->fresh()->status,
        );
        Storage::disk('local')->assertMissing(
            "presentation-upload-chunks/{$attachment->id}/payload.part",
        );
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

    public function test_manager_can_create_standalone_division_task_for_direct_report(): void
    {
        $manager = $this->userWithRole('Руководитель');
        $employee = $this->userWithRole('Сотрудник', $manager);
        $outsider = $this->userWithRole('Сотрудник');

        $this->actingAs($manager)
            ->post('/tasks', $this->standaloneTaskPayload($employee, [
                'division' => 'jvm',
            ]))
            ->assertRedirect();

        $task = Task::firstOrFail();
        $this->assertNull($task->project_id);
        $this->assertSame('jvm', $task->division);
        $this->assertSame($manager->id, $task->creator_id);

        $this->actingAs($employee)
            ->get('/tasks/jvm')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('crm/division-tasks')
                ->where('division', 'jvm')
                ->has('tasks', 1));

        $this->actingAs($outsider)
            ->get('/tasks/jvm')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('tasks', 0));

        $this->actingAs($employee)
            ->post('/tasks', $this->standaloneTaskPayload($employee))
            ->assertForbidden();
    }

    public function test_manager_cannot_assign_standalone_task_to_another_managers_employee(): void
    {
        $manager = $this->userWithRole('Руководитель');
        $otherManager = $this->userWithRole('Руководитель');
        $otherEmployee = $this->userWithRole('Сотрудник', $otherManager);

        $this->actingAs($manager)
            ->post('/tasks', $this->standaloneTaskPayload($otherEmployee))
            ->assertSessionHasErrors('assignee_id');

        $this->assertDatabaseCount('tasks', 0);
    }

    public function test_project_task_keeps_its_division_and_survives_project_deletion(): void
    {
        $manager = $this->userWithRole('Руководитель');
        $employee = $this->userWithRole('Сотрудник', $manager);
        $project = Project::create([
            ...$this->projectPayload(),
            'division' => 'ptl',
            'manager_id' => $manager->id,
        ]);
        $project->members()->attach($employee);

        $this->actingAs($manager)
            ->post('/tasks', $this->taskPayload($project, $employee))
            ->assertRedirect();

        $task = Task::firstOrFail();
        $this->assertSame('ptl', $task->division);
        $this->assertSame($project->id, $task->project_id);

        $this->actingAs($manager)
            ->delete("/projects/ptl/{$project->id}")
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', [
            'id' => $task->id,
            'project_id' => null,
            'division' => 'ptl',
        ]);
    }

    public function test_planning_excludes_standalone_tasks(): void
    {
        $manager = $this->userWithRole('Руководитель');
        $employee = $this->userWithRole('Сотрудник', $manager);
        $project = Project::create([
            ...$this->projectPayload(),
            'division' => 'wap',
            'manager_id' => $manager->id,
        ]);
        $project->members()->attach($employee);

        $this->actingAs($manager)->post('/tasks', $this->taskPayload($project, $employee))->assertRedirect();
        $this->actingAs($manager)->post('/tasks', $this->standaloneTaskPayload($employee, ['division' => 'wap']))->assertRedirect();

        $this->actingAs($employee)
            ->get('/planning')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('crm/planning')
                ->has('tasks', 1));
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

    private function putChunk(User $user, string $url, string $content): TestResponse
    {
        return $this->actingAs($user)->call(
            'PUT',
            $url,
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/octet-stream',
                'CONTENT_LENGTH' => (string) strlen($content),
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
            ],
            $content,
        );
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

    private function standaloneTaskPayload(User $assignee, array $overrides = []): array
    {
        return [
            'project_id' => null,
            'division' => 'jvm',
            'title' => 'Самостоятельная задача',
            'description' => 'Задача без проекта',
            'status' => 'planned',
            'priority' => 'normal',
            'assignee_id' => $assignee->id,
            'due_date' => '2026-08-15',
            ...$overrides,
        ];
    }
}
