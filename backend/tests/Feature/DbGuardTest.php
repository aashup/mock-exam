<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Diagnostic: proves which database the test suite actually connects to.
 * Must report the in-memory sqlite connection, NOT the dev MySQL — otherwise
 * RefreshDatabase elsewhere would wipe real data. No RefreshDatabase here, so
 * this test itself is non-destructive.
 */
class DbGuardTest extends TestCase
{
    public function test_suite_uses_sqlite_memory(): void
    {
        $default = config('database.default');
        $name = DB::connection()->getDatabaseName();
        $driver = DB::connection()->getDriverName();

        fwrite(STDERR, "\n[DbGuard] default={$default} driver={$driver} name={$name}\n");

        $this->assertSame('sqlite', $default, 'Test default connection must be sqlite');
        $this->assertSame('sqlite', $driver, 'Test driver must be sqlite');
    }
}
