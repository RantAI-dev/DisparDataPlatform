<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    protected function setUp(): void
    {
        parent::setUp();

        // Data API dipalsukan dengan Http::fake di alamat ini. Ditimpa di config, bukan env:
        // compose.dev.yaml mengisi DATA_API_URL (fixture-server) di $_SERVER, yang didahulukan
        // Laravel di atas <env> phpunit.xml.
        config([
            'dataapi.url' => 'http://data-api.test',
            'dataapi.token' => 'token-uji',
            'dataapi.retry_jeda_ms' => 0,
        ]);
    }
}
