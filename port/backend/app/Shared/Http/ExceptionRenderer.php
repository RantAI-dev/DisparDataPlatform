<?php

namespace App\Shared\Http;

use App\Shared\DataApi\DataApiException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Exceptions\MissingAbilityException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/** Semua error di /api/* dikembalikan dalam envelope gagal (SPEC §4.4). */
final class ExceptionRenderer
{
    public static function render(Throwable $e, Request $request): ?JsonResponse
    {
        if (! $request->is('api/*')) {
            return null;
        }

        return match (true) {
            $e instanceof DataApiException => ApiResponse::gagal($e->kode, $e->getMessage(), $e->status),
            $e instanceof ValidationException => ApiResponse::gagal('INVALID_PARAM', 'Parameter tidak valid.', 422, $e->errors()),
            $e instanceof AuthenticationException => ApiResponse::gagal('UNAUTHORIZED', 'Token tidak ada atau tidak valid.', 401),
            // Laravel mengubah AuthorizationException (termasuk MissingAbilityException Sanctum)
            // menjadi AccessDeniedHttpException sebelum renderer dipanggil.
            $e instanceof MissingAbilityException,
            $e instanceof AuthorizationException,
            $e instanceof AccessDeniedHttpException => ApiResponse::gagal('FORBIDDEN', 'Token tidak memiliki izin untuk akses ini.', 403),
            $e instanceof ThrottleRequestsException => self::terlaluSering($e),
            $e instanceof NotFoundHttpException => ApiResponse::gagal('NOT_FOUND', 'Alamat tidak ditemukan.', 404),
            $e instanceof MethodNotAllowedHttpException => ApiResponse::gagal('METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.', 405),
            $e instanceof HttpExceptionInterface => ApiResponse::gagal('HTTP_ERROR', 'Permintaan tidak dapat diproses.', $e->getStatusCode()),
            default => ApiResponse::gagal('INTERNAL', 'Terjadi kesalahan pada server.', 500),
        };
    }

    private static function terlaluSering(ThrottleRequestsException $e): JsonResponse
    {
        $res = ApiResponse::gagal('TOO_MANY_REQUESTS', 'Terlalu banyak permintaan. Coba lagi sebentar lagi.', 429);
        $res->headers->add($e->getHeaders());

        return $res;
    }
}
