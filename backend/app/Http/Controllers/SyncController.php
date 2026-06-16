<?php

namespace App\Http\Controllers;

use App\Services\SyncService;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function __construct(private SyncService $sync)
    {
    }

    /**
     * POST /api/sync — receive the device batch payload, upsert, and return
     * the device→server id mappings so the device can fill server_id columns.
     */
    public function push(Request $request)
    {
        \Log::info($request->all());
        $payload = $request->validate([
            'device_id' => ['nullable', 'string'],
            'last_synced_at' => ['nullable', 'string'],
            'question_sets' => ['array'],
            'questions' => ['array'],
            'options' => ['array'],
            'sessions' => ['array'],
            'attempts' => ['array'],
            'analytics' => ['array'],
            'app_usage' => ['array'],
            'locations' => ['array'],
            'locations.*.id' => ['nullable', 'integer'],
            'locations.*.server_id' => ['nullable', 'string'],
            'locations.*.latitude' => ['required', 'numeric'],
            'locations.*.longitude' => ['required', 'numeric'],
            'locations.*.accuracy' => ['required', 'numeric'],
            'locations.*.altitude' => ['nullable', 'numeric'],
            'locations.*.speed' => ['nullable', 'numeric'],
            'locations.*.heading' => ['nullable', 'numeric'],
            'locations.*.recorded_at' => ['required'],
            'locations.*.location_source' => ['in:gps,network,fused'],
            'locations.*.battery_level' => ['nullable', 'integer'],
        ]);

        $result = $this->sync->push($request->user(), $payload);

        return response()->json([
            'mappings' => $result['mappings'],
            'records_synced' => $result['records_synced'],
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * GET /api/sync/pull?since=<iso8601> — server-side changes delta.
     */
    public function pull(Request $request)
    {
        $since = $request->query('since');

        return response()->json($this->sync->pull($request->user(), $since));
    }
}
