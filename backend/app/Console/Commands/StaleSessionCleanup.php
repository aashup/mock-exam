<?php

namespace App\Console\Commands;

use App\Models\Session;
use Illuminate\Console\Command;

class StaleSessionCleanup extends Command
{
    protected $signature = 'sessions:cleanup-stale';

    protected $description = 'Mark active sessions older than 7 days as abandoned.';

    public function handle(): int
    {
        $count = Session::where('status', 'active')
            ->where('started_at', '<', now()->subDays(7))
            ->update(['status' => 'abandoned', 'updated_at' => now()]);

        $this->info("Marked {$count} stale session(s) as abandoned.");

        return self::SUCCESS;
    }
}
