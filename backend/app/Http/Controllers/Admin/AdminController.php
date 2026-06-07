<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function users()
    {
        return response()->json([
            'users' => User::select('id', 'name', 'email', 'role', 'device_id', 'last_sync_at', 'created_at')
                ->withCount(['sessions', 'questionSets'])
                ->orderByDesc('created_at')
                ->paginate(50),
        ]);
    }

    public function apiUsage()
    {
        $usage = DB::table('api_usage_logs')
            ->join('users', 'api_usage_logs.user_id', '=', 'users.id')
            ->selectRaw('users.id as user_id, users.email, api_usage_logs.provider, '
                . 'SUM(prompt_tokens) as prompt_tokens, '
                . 'SUM(completion_tokens) as completion_tokens, '
                . 'SUM(questions_generated) as questions_generated')
            ->groupBy('users.id', 'users.email', 'api_usage_logs.provider')
            ->orderByDesc('questions_generated')
            ->get();

        return response()->json(['usage' => $usage]);
    }

    public function activityLogs()
    {
        return response()->json([
            'logs' => DB::table('user_activity_logs')
                ->orderByDesc('created_at')
                ->paginate(100),
        ]);
    }

    public function deviceLocations()
    {
        $locations = DB::table('device_locations')
            ->leftJoin('users', 'device_locations.user_id', '=', 'users.id')
            ->select([
                'device_locations.id',
                'device_locations.user_id',
                'users.email as user_email',
                'device_locations.device_id',
                'device_locations.latitude',
                'device_locations.longitude',
                'device_locations.accuracy',
                'device_locations.altitude',
                'device_locations.speed',
                'device_locations.heading',
                'device_locations.location_source',
                'device_locations.battery_level',
                'device_locations.recorded_at',
                'device_locations.created_at',
            ])
            ->orderByDesc('device_locations.recorded_at')
            ->paginate(50);

        return response()->json(['locations' => $locations]);
    }
}
