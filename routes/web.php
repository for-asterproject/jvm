<?php

use App\Http\Controllers\ClientController;
use App\Http\Controllers\CompanyDetailController;
use App\Http\Controllers\ExchangeRateController;
use App\Http\Controllers\PresentationAttachmentController;
use App\Http\Controllers\PresentationController;
use App\Http\Controllers\PresentationUploadController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TaskReportUploadController;
use App\Http\Controllers\TaskWorkflowController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('/roles', [RoleController::class, 'index']);
    Route::post('/roles', [RoleController::class, 'store']);
    Route::post('/roles/assign', [RoleController::class, 'assignRole']);
    Route::post('/roles/revoke', [RoleController::class, 'revoke']);
    Route::delete('/users/{id}', [RoleController::class, 'destroyUser']);
    Route::put('/users/{id}/password', [RoleController::class, 'updateUserPassword']);
    Route::put('/users/{id}/manager', [RoleController::class, 'updateManager']);
    Route::get('/adminpanel', [RoleController::class, 'adminpanel']); // Админка
    Route::get('/productsmanagment', [RoleController::class, 'productsmanagment']); // товары
    Route::get('/rate', [RoleController::class, 'rate']); // курс
    Route::get('/company-details', [CompanyDetailController::class, 'edit']); // реквизиты компании
    Route::get('/company-details/current', [CompanyDetailController::class, 'show']); // получить реквизиты
    Route::put('/company-details', [CompanyDetailController::class, 'update']); // обновить реквизиты
    Route::get('/profile/user', [ProfileController::class, 'getUser']);

    Route::get('/exchange_rates/update', [ExchangeRateController::class, 'updateExchangeRate']); // получить курс с нацбанка
    Route::put('/exchange_rates/{id}', [ExchangeRateController::class, 'updateExchangeRateRoute']); // обновить курс
    Route::get('/exchange_rates/latest', [ExchangeRateController::class, 'getLatestExchangeRates']); // Получить актуальный курс
    Route::get('/exchange-rate/{currencyCode}', [ExchangeRateController::class, 'getExchangeRate']); // получить текущий курс по символу
    Route::get('/products', [ProductController::class, 'index']); // Получения всех продуктов
    Route::post('/products', [ProductController::class, 'store']); // Добавить продукцию
    Route::put('/products/{id}', [ProductController::class, 'update']); // Изменить продукцию
    Route::delete('/products/{id}', [ProductController::class, 'destroy']); // Удалить продукцию
    Route::post('/products/import', [ProductController::class, 'import']); // exel импорт продукции
    Route::get('/products/price', [ProductController::class, 'price']); // прайс

    Route::get('/presentations', [PresentationController::class, 'index'])->name('presentations.index');
    Route::post('/presentations', [PresentationController::class, 'store'])->name('presentations.store');
    Route::get('/presentations/{presentation}', [PresentationController::class, 'show'])->name('presentations.show');
    Route::put('/presentations/{presentation}', [PresentationController::class, 'update'])->name('presentations.update');
    Route::get('/presentations/{presentation}/download', [PresentationController::class, 'download'])->name('presentations.download');
    Route::delete('/presentations/{presentation}', [PresentationController::class, 'destroy'])->name('presentations.destroy');
    Route::post('/presentations/{presentation}/attachments/links', [PresentationAttachmentController::class, 'storeLink'])->name('presentations.attachments.links.store');
    Route::patch('/presentations/{presentation}/attachments/order', [PresentationAttachmentController::class, 'reorder'])->name('presentations.attachments.order');
    Route::get('/presentations/{presentation}/attachments/{attachment}/view', [PresentationAttachmentController::class, 'view'])->name('presentations.attachments.view');
    Route::get('/presentations/{presentation}/attachments/{attachment}/download', [PresentationAttachmentController::class, 'download'])->name('presentations.attachments.download');
    Route::delete('/presentations/{presentation}/attachments/{attachment}', [PresentationAttachmentController::class, 'destroy'])->name('presentations.attachments.destroy');
    Route::post('/presentations/{presentation}/uploads', [PresentationUploadController::class, 'store'])->name('presentations.uploads.store');
    Route::put('/presentations/{presentation}/uploads/{attachment}/chunks/{chunkIndex}', [PresentationUploadController::class, 'storeChunk'])->whereNumber('chunkIndex')->name('presentations.uploads.chunks.store');
    Route::post('/presentations/{presentation}/uploads/{attachment}/complete', [PresentationUploadController::class, 'complete'])->name('presentations.uploads.complete');
    Route::delete('/presentations/{presentation}/uploads/{attachment}', [PresentationUploadController::class, 'abort'])->name('presentations.uploads.abort');

    Route::get('/clients', [ClientController::class, 'index'])->name('clients.index');
    Route::post('/clients', [ClientController::class, 'store'])->name('clients.store');
    Route::put('/clients/{client}', [ClientController::class, 'update'])->name('clients.update');
    Route::delete('/clients/{client}', [ClientController::class, 'destroy'])->name('clients.destroy');

    Route::get('/projects/{division}', [ProjectController::class, 'index'])->name('projects.index');
    Route::post('/projects/{division}', [ProjectController::class, 'store'])->name('projects.store');
    Route::put('/projects/{division}/{project}', [ProjectController::class, 'update'])->name('projects.update');
    Route::delete('/projects/{division}/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');

    Route::get('/planning', [TaskController::class, 'index'])->name('planning.index');
    Route::get('/tasks/{division}', [TaskController::class, 'division'])->name('tasks.division');
    Route::post('/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::put('/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::patch('/tasks/{task}/status', [TaskController::class, 'updateStatus'])->name('tasks.status');
    Route::post('/tasks/{task}/comments', [TaskController::class, 'comment'])->name('tasks.comments.store');
    Route::get('/tasks/{task}/workflow', [TaskWorkflowController::class, 'show'])->name('tasks.workflow.show');
    Route::post('/tasks/{task}/start', [TaskWorkflowController::class, 'start'])->name('tasks.workflow.start');
    Route::post('/tasks/{task}/reports', [TaskWorkflowController::class, 'submit'])->name('tasks.reports.store');
    Route::patch('/tasks/{task}/reports/{report}/accept', [TaskWorkflowController::class, 'accept'])->name('tasks.reports.accept');
    Route::patch('/tasks/{task}/reports/{report}/revision', [TaskWorkflowController::class, 'revision'])->name('tasks.reports.revision');
    Route::post('/tasks/{task}/report-uploads', [TaskReportUploadController::class, 'store'])->name('tasks.report-uploads.store');
    Route::put('/tasks/{task}/report-uploads/{attachment}/chunks/{chunkIndex}', [TaskReportUploadController::class, 'storeChunk'])->whereNumber('chunkIndex')->name('tasks.report-uploads.chunks.store');
    Route::post('/tasks/{task}/report-uploads/{attachment}/complete', [TaskReportUploadController::class, 'complete'])->name('tasks.report-uploads.complete');
    Route::delete('/tasks/{task}/report-uploads/{attachment}', [TaskReportUploadController::class, 'abort'])->name('tasks.report-uploads.abort');
    Route::get('/tasks/{task}/report-attachments/{attachment}/view', [TaskReportUploadController::class, 'view'])->name('tasks.report-attachments.view');
    Route::get('/tasks/{task}/report-attachments/{attachment}/download', [TaskReportUploadController::class, 'download'])->name('tasks.report-attachments.download');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
