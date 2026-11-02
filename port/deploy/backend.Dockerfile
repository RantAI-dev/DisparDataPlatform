# Image produksi backend (SPEC §9): Laravel 10 di php-fpm 8.2 + nginx dalam satu container, Oracle
# Instant Client 19 + oci8. Bangun dari folder port/:
#   docker build -f deploy/backend.Dockerfile -t dispar-portal-backend .
# Pin IC, oci8, dan Composer sama dengan backend/Dockerfile (image dev/CI); ubah keduanya bersama.

# --- build: ekstensi PHP + vendor ---------------------------------------------------------------
FROM php:8.2-fpm-bookworm AS build

ARG IC_VERSI=19.33.0.0.0
ARG IC_DIR=1933000
ARG OCI8_VERSI=3.3.0
ARG COMPOSER_VERSI=2.8.12
# SHA256 resmi: halaman unduhan Instant Client Oracle dan getcomposer.org/.../composer.phar.sha256sum
ARG IC_BASIC_SHA256=a2fc1f32b776c1b574c231727d067cca522259c5d8854afdc41caf3ea8f7ef0d
ARG IC_SDK_SHA256=513126df5313318a27d849cdf30f9ef126dd4fa487f17d72db67d157b75ad2ff
ARG COMPOSER_SHA256=f446ea719708bb85fcbf4ef18def5d0515f1f9b4d703f6d820c9c1656e10a2f2

RUN apt-get update \
 && apt-get install -y --no-install-recommends libaio1 unzip libzip-dev libicu-dev \
 && rm -rf /var/lib/apt/lists/*

# Instant Client: basic (runtime) + sdk (header untuk kompilasi oci8). sdk dibuang setelah oci8
# terpasang; stage runtime hanya menyalin basic.
RUN set -eux; mkdir -p /opt/oracle; cd /opt/oracle; \
    for p in basic sdk; do \
      curl -fsSLo ic-$p.zip "https://download.oracle.com/otn_software/linux/instantclient/${IC_DIR}/instantclient-$p-linux.x64-${IC_VERSI}dbru.zip"; \
    done; \
    echo "${IC_BASIC_SHA256}  ic-basic.zip" | sha256sum -c -; \
    echo "${IC_SDK_SHA256}  ic-sdk.zip" | sha256sum -c -; \
    for p in basic sdk; do unzip -oq ic-$p.zip; rm ic-$p.zip; done; \
    mv instantclient_19_* instantclient; \
    echo /opt/oracle/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf; ldconfig

RUN set -eux; \
    echo "instantclient,/opt/oracle/instantclient" | pecl install "oci8-${OCI8_VERSI}"; \
    docker-php-ext-enable oci8; \
    docker-php-ext-install zip intl bcmath opcache pcntl; \
    php -m | grep -qx oci8; \
    rm -rf /opt/oracle/instantclient/sdk /tmp/pear

RUN curl -fsSL "https://getcomposer.org/download/${COMPOSER_VERSI}/composer.phar" -o /usr/local/bin/composer \
 && echo "${COMPOSER_SHA256}  /usr/local/bin/composer" | sha256sum -c - \
 && chmod +x /usr/local/bin/composer

WORKDIR /var/www/backend
# Dependensi dulu (layer cache), lalu kode. Skrip composer dilewati; `package:discover` dijalankan
# sendiri sesudahnya. Boot Laravel membuka koneksi Oracle untuk store cache `database`
# (SharedServiceProvider), jadi saat build cache dialihkan ke `array`; tidak ada yang di-cache ke image.
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-autoloader --no-scripts
COPY backend/ ./
RUN set -eux; \
    mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
      storage/framework/views storage/logs bootstrap/cache; \
    composer dump-autoload --no-dev --optimize --no-scripts; \
    CACHE_DRIVER=array php artisan package:discover; \
    rm -f .env

# --- runtime -----------------------------------------------------------------------------------
FROM php:8.2-fpm-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx libaio1 libzip4 libicu72 \
 && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled /etc/nginx/conf.d/* \
 && rm -f /usr/local/etc/php-fpm.d/*.conf

COPY --from=build /opt/oracle/instantclient /opt/oracle/instantclient
RUN echo /opt/oracle/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf && ldconfig
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient

COPY --from=build /usr/local/lib/php/extensions /usr/local/lib/php/extensions
COPY --from=build /usr/local/etc/php/conf.d /usr/local/etc/php/conf.d
RUN cp /usr/local/etc/php/php.ini-production /usr/local/etc/php/php.ini
COPY deploy/backend/php.ini /usr/local/etc/php/conf.d/zz-portal.ini
COPY deploy/backend/php-fpm.conf /usr/local/etc/php-fpm.d/portal.conf
COPY deploy/backend/nginx.conf /etc/nginx/nginx.conf
COPY deploy/backend/fastcgi-laravel.conf /etc/nginx/fastcgi-laravel.conf
COPY deploy/backend/entrypoint.sh /usr/local/bin/portal-entrypoint

WORKDIR /var/www/backend
# Kode milik root (hanya-baca bagi app); yang ditulis hanya storage/ dan bootstrap/cache.
COPY --from=build /var/www/backend ./
RUN set -eux; \
    chmod 0755 /usr/local/bin/portal-entrypoint; \
    chown -R www-data:www-data storage bootstrap/cache; \
    php -m | grep -qx oci8; \
    nginx -t -c /etc/nginx/nginx.conf; \
    rm -rf /tmp/nginx*

USER www-data
EXPOSE 8080
# Image php-fpm mewariskan STOPSIGNAL SIGQUIT, yang diabaikan bash sebagai PID 1. Entrypoint
# menangkap SIGTERM dan meneruskannya sebagai SIGQUIT (berhenti anggun) ke nginx dan php-fpm.
STOPSIGNAL SIGTERM
# HTTP 200 = nginx + php-fpm + Laravel hidup. Status `terganggu` (Oracle/Data API) tetap 200 dan
# dibaca pemantau dari isi JSON, supaya gangguan Data API tidak membuat container di-restart.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS -o /dev/null http://127.0.0.1:8080/api/v1/sistem/kesehatan || exit 1

ENTRYPOINT ["portal-entrypoint"]
