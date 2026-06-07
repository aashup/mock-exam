<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppUsage extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'app_usage';

    protected $fillable = [
        'user_id',
        'device_id',
        'date',
        'seconds_active',
    ];

    protected function casts(): array
    {
        // `date` is intentionally NOT cast to a Carbon date: the sync wire
        // contract uses a plain 'Y-m-d' string (the mobile app merges app_usage
        // rows by that date string). Casting would serialize it to an ISO
        // datetime and break the match, and would also store '... 00:00:00'
        // on sqlite. Keep it a raw string for cross-driver consistency.
        return [];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
