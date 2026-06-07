<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['set_id', 'text', 'explanation'];

    public function set(): BelongsTo
    {
        return $this->belongsTo(QuestionSet::class, 'set_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(Option::class);
    }
}
