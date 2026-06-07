FROM php:8.4-cli-alpine

# System dependencies (composer needs git + unzip; zip for archives)
RUN apk add --no-cache \
    git \
    curl \
    zip \
    unzip

# PHP extensions required by Laravel 11 + MySQL
RUN docker-php-ext-install pdo_mysql pcntl bcmath

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
