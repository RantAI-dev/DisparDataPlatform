<?php

namespace App\Features\Dataset\Http\Resources;

use App\Shared\LogHistory\LogContext;
use Illuminate\Contracts\Support\Responsable;
use Psr\Http\Message\ResponseInterface;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Ekspor diteruskan sebagai aliran (kelas S): body Data API disalin per potongan ke browser, header
 * berkas (`Content-Type`, `Content-Disposition`, `X-Row-Count`) ikut. Filter tercatat di
 * LOG_HISTORY lewat query request; jumlah baris dari `X-Row-Count`.
 */
final class EksporResource implements Responsable
{
    private const HEADER = ['Content-Type', 'Content-Disposition', 'X-Row-Count'];

    private const POTONGAN = 64 * 1024;

    public function __construct(private readonly ResponseInterface $aliran) {}

    public function toResponse($request): StreamedResponse
    {
        $konteks = app(LogContext::class);
        $konteks->sumber = 'data_api';
        $baris = $this->aliran->getHeaderLine('X-Row-Count');
        if (ctype_digit($baris)) {
            $konteks->jumlahBaris = (int) $baris;
        }

        $header = ['X-Accel-Buffering' => 'no', 'Cache-Control' => 'no-store', 'X-Request-Id' => $konteks->requestId()];
        foreach (self::HEADER as $nama) {
            if ($this->aliran->hasHeader($nama)) {
                $header[$nama] = $this->aliran->getHeaderLine($nama);
            }
        }

        $body = $this->aliran->getBody();

        return new StreamedResponse(function () use ($body) {
            while (! $body->eof()) {
                echo $body->read(self::POTONGAN);
                flush();
            }
        }, 200, $header);
    }
}
