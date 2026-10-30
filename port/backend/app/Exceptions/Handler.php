<?php

namespace App\Exceptions;

use App\Shared\Http\ExceptionRenderer;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        // Envelope gagal untuk semua error di /api/* (App\Shared\Http\ExceptionRenderer).
        $this->renderable(fn (Throwable $e, Request $request) => ExceptionRenderer::render($e, $request));

        $this->reportable(function (Throwable $e) {
            //
        });
    }
}
