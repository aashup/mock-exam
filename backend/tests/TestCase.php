<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Boot the app for tests, then HARD-PIN the database to an in-memory sqlite
     * connection.
     *
     * Why this is not left to phpunit.xml's <env> entries: this project runs in
     * Docker with `env_file: ./.env`, which injects DB_CONNECTION=mysql /
     * DB_DATABASE=exam_app as REAL process environment variables. Those win over
     * phpunit's `force="true"` overrides at runtime, so without this guard the
     * suite connects to the live MySQL dev database and RefreshDatabase wipes
     * the seeded question bank. Pinning the config here — after bootstrap, before
     * any trait (RefreshDatabase) boots in parent::setUp() — makes it impossible
     * for a test run to touch the dev database.
     */
    public function createApplication()
    {
        $app = require Application::inferBasePath().'/bootstrap/app.php';

        $app->make(Kernel::class)->bootstrap();

        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        // Telescope is dev-only tooling; never record during tests. Its
        // published migration reads telescope.storage.database.connection for
        // its target — pin it to the same sqlite test DB so the migration runs
        // against :memory: instead of trying to recreate the table on MySQL.
        $app['config']->set('telescope.enabled', false);
        $app['config']->set('telescope.storage.database.connection', 'sqlite');

        return $app;
    }
}
