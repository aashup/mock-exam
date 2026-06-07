<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Operational logging: sync runs, AI token usage, and user activity.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_id')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->unsignedInteger('records_synced')->default(0);
            $table->string('status')->default('success'); // success | partial | failed
            $table->timestamps();

            $table->index(['user_id', 'device_id']);
        });

        Schema::create('api_usage_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider');                    // gemini | chatgpt
            $table->unsignedInteger('prompt_tokens')->default(0);
            $table->unsignedInteger('completion_tokens')->default(0);
            $table->unsignedInteger('questions_generated')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'provider']);
        });

        Schema::create('user_activity_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_activity_logs');
        Schema::dropIfExists('api_usage_logs');
        Schema::dropIfExists('sync_logs');
    }
};
