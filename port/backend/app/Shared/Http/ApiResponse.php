<?php

namespace App\Shared\Http;

use App\Shared\DataApi\DataApiResponse;
use App\Shared\DataApi\JsonMentah;
use App\Shared\LogHistory\LogContext;
use Illuminate\Http\JsonResponse;
use stdClass;

/**
 * Envelope portal (SPEC §4.4). `data` disisipkan sebagai string JSON mentah, tidak di-decode ulang.
 */
final class ApiResponse
{
    /** @param 'data_api'|'cache'|'snapshot' $sumber */
    public static function dariDataApi(DataApiResponse $r, string $sumber = 'data_api', bool $stale = false): JsonResponse
    {
        return self::sukses($r->data, $r->meta, $sumber, $stale);
    }

    /**
     * @param  string  $dataJson  JSON mentah untuk kunci `data`
     * @param  'data_api'|'cache'|'snapshot'|null  $sumber  null = dibuat portal sendiri, bukan data sumber
     */
    public static function sukses(string $dataJson, ?stdClass $meta = null, ?string $sumber = 'data_api', bool $stale = false, int $status = 200): JsonResponse
    {
        $konteks = app(LogContext::class);
        $meta = $meta ? clone $meta : new stdClass;
        $meta->request_id = $konteks->requestId();
        $meta->sumber = $sumber;
        $meta->stale = $stale;

        $konteks->sumber = $sumber;
        if (isset($meta->total) && is_int($meta->total)) {
            $konteks->jumlahBaris = $meta->total;
        }

        $body = '{"success":true,"message":"OK","data":'.$dataJson.',"meta":'.JsonMentah::encode($meta).'}';

        return new JsonResponse($body, $status, [], 0, true);
    }

    /** @param array<string, array<int, string>>|null $fields */
    public static function gagal(string $kode, string $pesan, int $status, ?array $fields = null): JsonResponse
    {
        $errors = ['code' => $kode];
        if ($fields !== null) {
            $errors['fields'] = $fields;
        }

        return new JsonResponse([
            'success' => false,
            'message' => $pesan,
            'errors' => $errors,
            'meta' => ['request_id' => app(LogContext::class)->requestId()],
        ], $status, [], JsonMentah::FLAG);
    }
}
