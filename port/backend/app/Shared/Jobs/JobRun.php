<?php

namespace App\Shared\Jobs;

use Illuminate\Database\Eloquent\Model;

/** Satu baris JOB_RUNS per eksekusi job cron/manual (SPEC §4.5). */
final class JobRun extends Model
{
    protected $table = 'job_runs';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = [
        'mulai' => 'immutable_datetime',
        'selesai' => 'immutable_datetime',
        'ringkasan' => 'array',
    ];
}
