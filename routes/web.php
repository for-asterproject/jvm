<?php

use App\Http\Controllers\ClientController;
use App\Http\Controllers\CompanyDetailController;
use App\Http\Controllers\ExchangeRateController;
use App\Http\Controllers\PresentationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\TaskController;
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
    Route::put('/presentations/{presentation}', [PresentationController::class, 'update'])->name('presentations.update');
    Route::get('/presentations/{presentation}/download', [PresentationController::class, 'download'])->name('presentations.download');
    Route::delete('/presentations/{presentation}', [PresentationController::class, 'destroy'])->name('presentations.destroy');

    Route::get('/clients', [ClientController::class, 'index'])->name('clients.index');
    Route::post('/clients', [ClientController::class, 'store'])->name('clients.store');
    Route::put('/clients/{client}', [ClientController::class, 'update'])->name('clients.update');
    Route::delete('/clients/{client}', [ClientController::class, 'destroy'])->name('clients.destroy');

    Route::get('/projects/{division}', [ProjectController::class, 'index'])->name('projects.index');
    Route::post('/projects/{division}', [ProjectController::class, 'store'])->name('projects.store');
    Route::put('/projects/{division}/{project}', [ProjectController::class, 'update'])->name('projects.update');
    Route::delete('/projects/{division}/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');

    Route::get('/planning', [TaskController::class, 'index'])->name('planning.index');
    Route::post('/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::put('/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::patch('/tasks/{task}/status', [TaskController::class, 'updateStatus'])->name('tasks.status');
    Route::post('/tasks/{task}/comments', [TaskController::class, 'comment'])->name('tasks.comments.store');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
