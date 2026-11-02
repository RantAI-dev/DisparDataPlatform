<?php

namespace App\Shared\Http\Middleware;

use App\Shared\Http\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pengaman kedua aturan "tanpa PATCH" (SPEC §4.3 butir 6). Dipasang GLOBAL di Kernel, karena
 * rute yang tidak cocok sudah dijawab 405 sebelum middleware grup sempat berjalan.
 */
final class RejectPatch
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('PATCH')) {
            return ApiResponse::gagal('METHOD_NOT_ALLOWED', 'Metode PATCH tidak didukung.', 405);
        }

        return $next($request);
    }
}
