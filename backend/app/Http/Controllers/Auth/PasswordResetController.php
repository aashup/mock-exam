<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function forgot(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $data['email'])->first();

        // Always respond 200 to avoid leaking which emails exist.
        if ($user) {
            $token = Str::random(64);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $user->email],
                ['token' => Hash::make($token), 'created_at' => now()]
            );

            // In production, dispatch a notification/email with $token here.
            // Mail::to($user)->send(new PasswordResetMail($token));
        }

        return response()->json([
            'message' => 'If that email exists, a reset link has been sent.',
        ]);
    }

    public function reset(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('email', $data['email'])
            ->first();

        if (! $record || ! Hash::check($data['token'], $record->token)) {
            throw ValidationException::withMessages([
                'token' => ['Invalid or expired reset token.'],
            ]);
        }

        // Token valid for 60 minutes. (Use isPast() rather than diffInMinutes:
        // under Carbon 3 diffInMinutes is signed and returns a negative value
        // for past timestamps, so the old `> 60` check never fired.)
        if (Carbon::parse($record->created_at)->addMinutes(60)->isPast()) {
            throw ValidationException::withMessages([
                'token' => ['Reset token has expired.'],
            ]);
        }

        $user = User::where('email', $data['email'])->firstOrFail();
        $user->forceFill(['password' => $data['password']])->save();

        // Invalidate all tokens + remove the reset record.
        $user->tokens()->delete();
        DB::table('password_reset_tokens')->where('email', $data['email'])->delete();

        return response()->json(['message' => 'Password has been reset.']);
    }
}
