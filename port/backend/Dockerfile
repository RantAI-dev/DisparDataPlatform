# PHP 8.2 + Oracle Instant Client 19 + oci8 untuk Laravel 10 (SPEC §4.1).
# Versi disematkan: ganti hanya lewat PR yang mencatat alasannya.
FROM php:8.2-fpm-bookworm

ARG IC_VERSI=19.33.0.0.0
ARG IC_DIR=1933000
ARG OCI8_VERSI=3.3.0
ARG COMPOSER_VERSI=2.8.12
# SHA256 resmi: halaman unduhan Instant Client Oracle dan getcomposer.org/.../composer.phar.sha256sum
ARG IC_BASIC_SHA256=a2fc1f32b776c1b574c231727d067cca522259c5d8854afdc41caf3ea8f7ef0d
ARG IC_SDK_SHA256=513126df5313318a27d849cdf30f9ef126dd4fa487f17d72db67d157b75ad2ff
ARG COMPOSER_SHA256=f446ea719708bb85fcbf4ef18def5d0515f1f9b4d703f6d820c9c1656e10a2f2

RUN apt-get update \
 && apt-get install -y --no-install-recommends libaio1 unzip curl libzip-dev libicu-dev \
 && rm -rf /var/lib/apt/lists/*

# Instant Client: basic (runtime) + sdk (header untuk kompilasi oci8)
RUN set -eux; mkdir -p /opt/oracle; cd /opt/oracle; \
    for p in basic sdk; do \
      curl -fsSLo ic-$p.zip "https://download.oracle.com/otn_software/linux/instantclient/${IC_DIR}/instantclient-$p-linux.x64-${IC_VERSI}dbru.zip"; \
    done; \
    echo "${IC_BASIC_SHA256}  ic-basic.zip" | sha256sum -c -; \
    echo "${IC_SDK_SHA256}  ic-sdk.zip" | sha256sum -c -; \
    for p in basic sdk; do unzip -oq ic-$p.zip; rm ic-$p.zip; done; \
    mv instantclient_19_* instantclient; \
    echo /opt/oracle/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf; ldconfig

ENV LD_LIBRARY_PATH=/opt/oracle/instantclient

RUN set -eux; \
    echo "instantclient,/opt/oracle/instantclient" | pecl install "oci8-${OCI8_VERSI}"; \
    docker-php-ext-enable oci8; \
    docker-php-ext-install zip intl bcmath opcache pcntl; \
    php -m | grep -qx oci8

RUN curl -fsSL "https://getcomposer.org/download/${COMPOSER_VERSI}/composer.phar" -o /usr/local/bin/composer \
 && echo "${COMPOSER_SHA256}  /usr/local/bin/composer" | sha256sum -c - \
 && chmod +x /usr/local/bin/composer

WORKDIR /var/www/backend
