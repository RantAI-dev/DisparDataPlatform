<?php

namespace App\Shared\Http\Middleware;

use App\Shared\LogHistory\LogContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Pakai X-Request-Id dari Nuxt bila formatnya aman; bila tidak, buat baru. Dipantulkan di respons. */
final class RequestId
{
    public function __construct(private readonly LogContext $konteks) {}

    public function handle(Request $request, Closure $next): Response
    {
        $masuk = (string) $request->headers->get('X-Request-Id', '');
        if (preg_match('/^[A-Za-z0-9._-]{8,64}$/', $masuk) === 1) {
            $this->konteks->setRequestId($masuk);
        }

        $response = $next($request);
        $response->headers->set('X-Request-Id', $this->konteks->requestId());

        return $response;
    }
}
