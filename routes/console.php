<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('exchange_rates:update')->daily(); // php artisan exchange_rates:update //* * * * * php /path-to-your-project/artisan schedule:run >> /dev/null 2>&1
Schedule::command('presentations:cleanup-uploads')->hourly();
Schedule::command('tasks:cleanup-report-uploads')->hourly();
