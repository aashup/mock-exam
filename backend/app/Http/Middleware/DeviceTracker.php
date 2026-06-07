<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records the calling device_id on the authenticated user so the backend
 * knows which device last touched the account (multi-device sync support).
 */
class DeviceTracker
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $deviceId = $request->header('X-Device-Id') ?? $request->input('device_id');

        if ($user && $deviceId && $user->device_id !== $deviceId) {
            $user->forceFill(['device_id' => $deviceId])->save();
        }

        return $next($request);
    }
}
