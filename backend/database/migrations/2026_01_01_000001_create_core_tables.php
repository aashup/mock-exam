<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Users (+ role for admin gate), password resets, and the reference data:
 * subjects, courses, and the MANY-TO-MANY course_subject pivot.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('mobile')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('role', ['student', 'admin'])->default('student');
            $table->string('device_id')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions_store', function (Blueprint $table) {
            // Laravel framework session table (renamed to avoid clash with our
            // domain "sessions" table created in a later migration).
            $table->string('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('subjects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('courses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('exam_type')->nullable();
            $table->timestamps();
        });

        // MANY-TO-MANY: a course has many subjects and a subject many courses.
        Schema::create('course_subject', function (Blueprint $table) {
            $table->foreignUuid('course_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('subject_id')->constrained()->cascadeOnDelete();
            $table->primary(['course_id', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_subject');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('subjects');
        Schema::dropIfExists('sessions_store');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
