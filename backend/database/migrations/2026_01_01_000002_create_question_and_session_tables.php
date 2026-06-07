<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI question bank + test sessions + attempts + analytics + app usage.
 *
 * Design notes:
 *  - question_sets.subject_id is the PRIMARY driver (NOT NULL).
 *  - question_sets.course_id is OPTIONAL context (nullable).
 *  - difficulty is constrained to Easy | Medium | Hard via enum.
 *  - Every user-data table carries updated_at for last-write-wins sync.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('question_sets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            // PRIMARY driver — required.
            $table->foreignUuid('subject_id')->constrained()->cascadeOnDelete();
            // OPTIONAL context — nullable.
            $table->foreignUuid('course_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('difficulty', ['Easy', 'Medium', 'Hard']);
            $table->string('ai_provider')->nullable();      // gemini | chatgpt
            $table->text('prompt_used')->nullable();
            $table->unsignedInteger('total_questions')->default(0);
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'subject_id', 'difficulty']);
        });

        Schema::create('questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('set_id')->constrained('question_sets')->cascadeOnDelete();
            $table->text('text');
            $table->text('explanation')->nullable();
            $table->timestamps();

            $table->index('set_id');
        });

        Schema::create('options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('question_id')->constrained()->cascadeOnDelete();
            $table->text('text');
            $table->boolean('is_correct')->default(false);
            $table->timestamps();

            $table->index('question_id');
        });

        Schema::create('sessions', function (Blueprint $table) {
            // Domain test-session table (framework sessions live in sessions_store).
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('set_id')->constrained('question_sets')->cascadeOnDelete();
            $table->enum('mode', ['timed', 'untimed'])->default('untimed');
            $table->enum('feedback_mode', ['immediate', 'end'])->default('end');
            $table->unsignedInteger('total_questions')->default(0);
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->decimal('score', 5, 2)->nullable();
            $table->enum('status', ['active', 'completed', 'abandoned'])->default('active');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('session_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('question_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('selected_option_id')->nullable()->constrained('options')->nullOnDelete();
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('time_taken_seconds')->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->timestamps();

            $table->index('session_id');
        });

        Schema::create('analytics', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('subject_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('course_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('difficulty', ['Easy', 'Medium', 'Hard'])->nullable();
            $table->unsignedInteger('total_attempted')->default(0);
            $table->unsignedInteger('total_correct')->default(0);
            $table->decimal('accuracy_percent', 5, 2)->default(0);
            $table->decimal('avg_time_per_question', 8, 2)->default(0);
            $table->timestamps();

            $table->index(['user_id', 'subject_id', 'difficulty']);
        });

        Schema::create('app_usage', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_id')->nullable();
            $table->date('date');
            $table->unsignedInteger('seconds_active')->default(0);
            $table->timestamps();

            // One aggregated row per user per device per day.
            $table->unique(['user_id', 'device_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_usage');
        Schema::dropIfExists('analytics');
        Schema::dropIfExists('attempts');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('options');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('question_sets');
    }
};
