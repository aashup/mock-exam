<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Auth surface: register/login, token refresh + logout invalidation, and the
 * forgot/reset password flow (including token expiry — a regression guard for
 * the Carbon 3 signed-diff bug where expired tokens were silently accepted).
 */
class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_refresh_rotates_token_and_old_token_is_revoked(): void
    {
        $old = $this->postJson('/api/auth/register', [
            'name' => 'Rf', 'email' => 'rf@test.com', 'mobile' => '+1 555 0100',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated()->json('token');

        // token plaintext is "<id>|<secret>"; the id prefix is the DB row id.
        $oldId = (int) explode('|', $old)[0];

        $new = $this->withToken($old)->postJson('/api/auth/refresh-token')
            ->assertOk()->json('token');
        $newId = (int) explode('|', $new)[0];

        $this->assertNotEquals($old, $new);
        // Assert revocation at the DB layer: the Sanctum guard caches the
        // resolved user across requests within one test app instance, so a
        // second HTTP call with the old token can't reliably observe deletion.
        // (The live HTTP smoke confirms the old token returns 401.)
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $oldId]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $newId]);
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $token = $this->postJson('/api/auth/register', [
            'name' => 'Lo', 'email' => 'lo@test.com', 'mobile' => '+1 555 0101',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated()->json('token');

        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_forgot_password_does_not_leak_account_existence(): void
    {
        // Unknown email still returns 200 with the same generic message.
        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@test.com'])
            ->assertOk()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseCount('password_reset_tokens', 0);
    }

    public function test_reset_with_valid_token_changes_password_and_clears_tokens(): void
    {
        $user = User::factory()->create(['email' => 'reset@test.com']);

        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make('KNOWN'),
            'created_at' => now(),
        ]);

        // Wrong token rejected.
        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email, 'token' => 'WRONG', 'password' => 'newpass123',
        ])->assertStatus(422);

        // Correct token accepted.
        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email, 'token' => 'KNOWN', 'password' => 'newpass123',
        ])->assertOk();

        $this->assertTrue(Hash::check('newpass123', $user->fresh()->password));
        $this->assertDatabaseCount('password_reset_tokens', 0);

        // New password logs in.
        $this->postJson('/api/auth/login', [
            'email' => $user->email, 'password' => 'newpass123',
        ])->assertOk();
    }

    public function test_expired_reset_token_is_rejected(): void
    {
        $user = User::factory()->create(['email' => 'expired@test.com']);

        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make('KNOWN'),
            'created_at' => now()->subMinutes(90), // > 60 min TTL
        ]);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email, 'token' => 'KNOWN', 'password' => 'newpass123',
        ])->assertStatus(422)->assertJsonValidationErrors('token');

        // Password unchanged — the expired token must not have reset it.
        $this->postJson('/api/auth/login', [
            'email' => $user->email, 'password' => 'newpass123',
        ])->assertStatus(422);
    }
}
