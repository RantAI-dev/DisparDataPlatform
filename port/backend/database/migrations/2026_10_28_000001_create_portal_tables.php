<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Tabel milik app (SPEC §4.5, §4.6, §6): log history, job, snapshot, dan store cache Laravel.
// Aturan Oracle: nama huruf kecil tanpa kutip, ≤ 30 karakter, tanpa BOOLEAN, JSON di CLOB + IS JSON.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('log_history', function (Blueprint $table) {
            $table->id();
            $table->string('request_id', 64);
            $table->string('modul', 50)->nullable();
            $table->string('aksi', 150)->nullable();
            $table->string('metode', 10);
            $table->string('path', 500);
            $table->string('param_hash', 64);
            $table->string('param_ringkas', 2000)->nullable();
            $table->string('klien', 100)->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->integer('status_http');
            $table->integer('durasi_ms');
            $table->integer('jumlah_baris')->nullable();
            $table->string('sumber', 20)->nullable();
            $table->timestamp('dibuat_pada');
            $table->index(['modul', 'dibuat_pada'], 'log_hist_modul_idx');
            $table->index('request_id', 'log_hist_rid_idx');
        });

        Schema::create('job_runs', function (Blueprint $table) {
            $table->id();
            $table->string('job', 100);
            $table->string('pemicu', 10);
            $table->string('klien', 100)->nullable();
            $table->timestamp('mulai');
            $table->timestamp('selesai')->nullable();
            $table->string('status', 10);
            $table->longText('ringkasan')->nullable();
            $table->index(['job', 'mulai'], 'job_runs_job_idx');
        });
        DB::statement('alter table job_runs add constraint job_runs_ringkasan_json check (ringkasan is json)');

        Schema::create('snapshot', function (Blueprint $table) {
            $table->string('kunci', 200)->primary('snapshot_pk');
            $table->longText('isi');
            $table->timestamp('diambil_pada');
            $table->string('hash', 64);
        });
        DB::statement('alter table snapshot add constraint snapshot_isi_json check (isi is json)');

        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary('cache_pk');
            $table->longText('value');
            $table->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary('cache_locks_pk');
            $table->string('owner');
            $table->integer('expiration');
        });
    }

    public function down(): void
    {
        foreach (['cache_locks', 'cache', 'snapshot', 'job_runs', 'log_history'] as $tabel) {
            Schema::dropIfExists($tabel);
        }
    }
};
