<?php

use App\Http\Controllers\CompanyDetailController;
use App\Http\Controllers\ExchangeRateController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\Settings\ProfileController;


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
    Route::get('/adminpanel', [RoleController::class, 'adminpanel']);//Админка
    Route::get('/productsmanagment', [RoleController::class, 'productsmanagment']);//товары
    Route::get('/rate', [RoleController::class, 'rate']);//курс
    Route::get('/company-details', [CompanyDetailController::class, 'edit']);//реквизиты компании
    Route::get('/company-details/current', [CompanyDetailController::class, 'show']);//получить реквизиты
    Route::put('/company-details', [CompanyDetailController::class, 'update']);//обновить реквизиты
    Route::get('/profile/user', [ProfileController::class, 'getUser']);

    Route::get('/exchange_rates/update', [ExchangeRateController::class, 'updateExchangeRate']);//получить курс с нацбанка
    Route::put('/exchange_rates/{id}', [ExchangeRateController::class, 'updateExchangeRateRoute']);//обновить курс
    Route::get('/exchange_rates/latest', [ExchangeRateController::class, 'getLatestExchangeRates']);//Получить актуальный курс
    Route::get('/exchange-rate/{currencyCode}', [ExchangeRateController::class, 'getExchangeRate']);//получить текущий курс по символу
    Route::get('/products', [ProductController::class, 'index']); //Получения всех продуктов
    Route::post('/products', [ProductController::class, 'store']); // Добавить продукцию
    Route::put('/products/{id}', [ProductController::class, 'update']); // Изменить продукцию
    Route::delete('/products/{id}', [ProductController::class, 'destroy']); // Удалить продукцию
    Route::post('/products/import', [ProductController::class, 'import']); // exel импорт продукции
    Route::get('/products/price', [ProductController::class, 'price']);//прайс
});


require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
