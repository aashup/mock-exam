<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Analytics extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'analytics';

    protected $fillable = [
        'user_id',
        'subject_id',
        'course_id',
        'difficulty',
        'total_attempted',
        'total_correct',
        'accuracy_percent',
        'avg_time_per_question',
    ];

    protected function casts(): array
    {
        return [
            'accuracy_percent' => 'decimal:2',
            'avg_time_per_question' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
