<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/** Akun layanan portal (frontend, admin). Tanpa password; akses lewat token Sanctum. */
class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = ['name', 'email'];
}
