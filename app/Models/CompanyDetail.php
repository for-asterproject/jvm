<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanyDetail extends Model
{
    protected $fillable = [
        'company_name',
        'legal_address',
        'email',
        'bin',
        'bank_name',
        'bank_bik',
        'iban_kzt',
        'kbe',
        'vat_rate',
    ];
}