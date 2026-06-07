<?php

use App\Console\Commands\StaleSessionCleanup;
use App\Console\Commands\SyncReminder;
use Illuminate\Support\Facades\Schedule;

// Nudge users who haven't synced in 24h.
Schedule::command(SyncReminder::class)->dailyAt('09:00');

// Mark sessions older than 7 days still 'active' as 'abandoned'.
Schedule::command(StaleSessionCleanup::class)->hourly();
