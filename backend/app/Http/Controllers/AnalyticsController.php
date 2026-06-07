<?php

namespace App\Http\Controllers;

use App\Services\AnalyticsService;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function __construct(private AnalyticsService $analytics)
    {
    }

    /**
     * GET /api/analytics/summary — dashboard totals.
     */
    public function summary(Request $request)
    {
        return response()->json($this->analytics->summary($request->user()));
    }

    /**
     * GET /api/analytics/subjects — per-subject accuracy breakdown.
     */
    public function subjects(Request $request)
    {
        return response()->json([
            'subjects' => $this->analytics->perSubject($request->user()),
        ]);
    }
}
