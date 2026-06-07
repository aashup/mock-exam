<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Course extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['name', 'exam_type'];

    /**
     * MANY-TO-MANY: a course has many subjects (pivot course_subject).
     */
    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'course_subject');
    }
}
