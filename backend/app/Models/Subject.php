<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subject extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['name'];

    /**
     * MANY-TO-MANY: a subject belongs to many courses (pivot course_subject).
     */
    public function courses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'course_subject');
    }

    /**
     * Ordered syllabus topics for this subject.
     */
    public function topics(): HasMany
    {
        return $this->hasMany(Topic::class)->orderBy('position');
    }
}
