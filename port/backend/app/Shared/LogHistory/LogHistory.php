<?php

namespace App\Shared\LogHistory;

use Illuminate\Database\Eloquent\Model;

/** Satu baris LOG_HISTORY per request /api/v1 (SPEC §4.5). */
final class LogHistory extends Model
{
    protected $table = 'log_history';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = ['dibuat_pada' => 'immutable_datetime'];
}
