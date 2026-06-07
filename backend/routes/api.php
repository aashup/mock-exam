<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Admin\QuestionController as AdminQuestionController;
use App\Http\Controllers\Admin\QuestionSetController as AdminQuestionSetController;
use App\Http\Controllers\Admin\SubjectController as AdminSubjectController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\ReferenceController;
use App\Http\Controllers\RestoreController;
use App\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public auth routes
|--------------------------------------------------------------------------
*/
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [PasswordResetController::class, 'forgot']);
    Route::post('reset-password', [PasswordResetController::class, 'reset']);
});

/*
|--------------------------------------------------------------------------
| Authenticated routes (Sanctum) — device tracked + activity logged
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'device.tracker', 'api.logger'])->group(function () {
    // Auth session
    Route::prefix('auth')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::post('refresh-token', [AuthController::class, 'refreshToken']);
    });

    // Reference data
    Route::get('subjects', [ReferenceController::class, 'subjects']);
    Route::get('courses', [ReferenceController::class, 'courses']);
    Route::get('subjects/{subject}/courses', [ReferenceController::class, 'coursesForSubject']);

    // Sync + restore
    Route::post('sync', [SyncController::class, 'push']);
    Route::get('sync/pull', [SyncController::class, 'pull']);
    Route::get('restore', [RestoreController::class, 'index']);

    // Analytics / dashboard
    Route::get('analytics/summary', [AnalyticsController::class, 'summary']);
    Route::get('analytics/subjects', [AnalyticsController::class, 'subjects']);

    /*
    |----------------------------------------------------------------------
    | Admin routes — role:admin gated
    |----------------------------------------------------------------------
    */
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('users', [AdminController::class, 'users']);
        Route::get('api-usage', [AdminController::class, 'apiUsage']);
        Route::get('activity-logs', [AdminController::class, 'activityLogs']);
        Route::get('device-locations', [AdminController::class, 'deviceLocations']);

        // Subject CRUD
        Route::get('subjects', [AdminSubjectController::class, 'index']);
        Route::post('subjects', [AdminSubjectController::class, 'store']);
        Route::put('subjects/{subject}', [AdminSubjectController::class, 'update']);
        Route::delete('subjects/{subject}', [AdminSubjectController::class, 'destroy']);

        // Course CRUD + M2M subject linking
        Route::get('courses', [AdminCourseController::class, 'index']);
        Route::post('courses', [AdminCourseController::class, 'store']);
        Route::put('courses/{course}', [AdminCourseController::class, 'update']);
        Route::delete('courses/{course}', [AdminCourseController::class, 'destroy']);
        Route::post('courses/{course}/subjects', [AdminCourseController::class, 'syncSubjects']);

        // AI question sets — manual generate (copy prompt) + import (paste JSON)
        Route::get('question-sets', [AdminQuestionSetController::class, 'index']);
        Route::post('question-sets', [AdminQuestionSetController::class, 'store']);
        Route::delete('question-sets/{questionSet}', [AdminQuestionSetController::class, 'destroy']);

        // Per-question management (list/add within a set; edit/delete a question)
        Route::get('question-sets/{questionSet}/questions', [AdminQuestionController::class, 'index']);
        Route::post('question-sets/{questionSet}/questions', [AdminQuestionController::class, 'store']);
        Route::put('questions/{question}', [AdminQuestionController::class, 'update']);
        Route::delete('questions/{question}', [AdminQuestionController::class, 'destroy']);
    });
});
