<?php

namespace App\Http\Controllers;

use App\Models\CompanyDetail;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CompanyDetailController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/company-details');
    }

    public function show()
    {
        return response()->json($this->formatCompanyDetails($this->getCompanyDetails()));
    }

    public function update(Request $request)
    {
        $validatedData = $request->validate([
            'company_name' => 'required|string|max:255',
            'legal_address' => 'required|string|max:1000',
            'email' => 'required|email|max:255',
            'bin' => 'required|string|max:20',
            'bank_name' => 'required|string|max:255',
            'bank_bik' => 'required|string|max:50',
            'iban_kzt' => 'required|string|max:34',
            'kbe' => 'required|string|max:10',
            'vat_rate' => 'required|numeric|min:0|max:100',
        ]);

        $companyDetails = $this->getCompanyDetails();
        $companyDetails->update($validatedData);

        return response()->json([
            'message' => 'Реквизиты компании успешно обновлены.',
            'companyDetails' => $this->formatCompanyDetails($companyDetails->fresh()),
        ]);
    }

    private function getCompanyDetails(): CompanyDetail
    {
        return CompanyDetail::firstOrCreate(
            ['id' => 1],
            [
                'company_name' => 'ТОО «Aster Project» («Астер Проджект»)',
                'legal_address' => 'г Алматы, Хусаинова улица, 2811 этаж Бостандыкский район, Алматы, 050060/A15T8Y9',
                'email' => 'info@aster-project.kz',
                'bin' => '140640020043',
                'bank_name' => 'АО «Банк Центр Кредит»',
                'bank_bik' => 'KCJBKZKX',
                'iban_kzt' => 'KZ858562203116747548',
                'kbe' => '17',
                'vat_rate' => 12.00,
            ]
        );
    }

    private function formatCompanyDetails(CompanyDetail $companyDetails): array
    {
        return [
            'id' => $companyDetails->id,
            'company_name' => $companyDetails->company_name,
            'legal_address' => $companyDetails->legal_address,
            'email' => $companyDetails->email,
            'bin' => $companyDetails->bin,
            'bank_name' => $companyDetails->bank_name,
            'bank_bik' => $companyDetails->bank_bik,
            'iban_kzt' => $companyDetails->iban_kzt,
            'kbe' => $companyDetails->kbe,
            'vat_rate' => $companyDetails->vat_rate,
            'formatted_details' => sprintf(
                '%s. Юридический адрес: %s. Эл. адрес: %s. БИН %s. в %s. БСК/БИК (SWIFT) %s. ИИК %s (KZT). КБЕ %s.',
                $companyDetails->company_name,
                $companyDetails->legal_address,
                $companyDetails->email,
                $companyDetails->bin,
                $companyDetails->bank_name,
                $companyDetails->bank_bik,
                $companyDetails->iban_kzt,
                $companyDetails->kbe,
            ),
        ];
    }
}