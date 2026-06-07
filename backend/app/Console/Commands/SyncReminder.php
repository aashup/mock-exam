<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class SyncReminder extends Command
{
    protected $signature = 'sync:remind';

    protected $description = 'Notify users who have not synced in the last 24 hours.';

    public function handle(): int
    {
        $stale = User::where('role', 'student')
            ->where(function ($q) {
                $q->whereNull('last_sync_at')
                    ->orWhere('last_sync_at', '<', now()->subDay());
            })
            ->get();

        foreach ($stale as $user) {
            // In production: dispatch a push/email notification here.
            // $user->notify(new SyncReminderNotification());
            $this->line("Reminder queued for {$user->email}");
        }

        $this->info("Processed {$stale->count()} user(s) needing a sync reminder.");

        return self::SUCCESS;
    }
}
