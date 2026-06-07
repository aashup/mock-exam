<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lightweight request activity logger. Records the action + path for
 * authenticated API calls into user_activity_logs. AI token accounting is
 * recorded separately via api_usage_logs when generation results are synced.
 */
class ApiUsageLogger
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        if ($user) {
            DB::table('user_activity_logs')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'action' => $request->method() . ' ' . $request->path(),
                'metadata' => json_encode([
                    'status' => $response->getStatusCode(),
                    'device_id' => $request->header('X-Device-Id'),
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $response;
    }
}
