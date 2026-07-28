# Хранение файлов презентаций на сервере

Файлы презентаций сохраняются в приватной директории Laravel:

```text
storage/app/private/presentations
```

Временные части незавершённых загрузок находятся в:

```text
storage/app/private/presentation-upload-chunks
```

Эти директории не должны публиковаться через `public/` или отдельный
веб-серверный location. Просмотр и скачивание проходят через приложение после
проверки прав пользователя.

## Требования к серверу

Пользователь веб-сервера должен иметь право записи в `storage/`:

```bash
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache
```

Для стандартного чанка 16 МБ рекомендуется разрешить запросы до 20 МБ.
Пример для Nginx:

```nginx
client_max_body_size 20m;
client_body_timeout 300s;
```

После изменения конфигурации проверьте и перезагрузите Nginx:

```bash
nginx -t
systemctl reload nginx
```

Для PHP можно оставить общий лимит загрузки небольшим, поскольку файл
передаётся последовательными PUT-запросами по 16 МБ. Рекомендуемые безопасные
значения:

```ini
post_max_size = 20M
upload_max_filesize = 20M
memory_limit = 256M
max_execution_time = 300
```

## Развёртывание

Примените миграции и сбросьте кэш конфигурации:

```bash
php artisan migrate
php artisan optimize:clear
```

Laravel scheduler должен запускаться каждую минуту:

```cron
* * * * * cd /path/to/jvm && php artisan schedule:run >> /dev/null 2>&1
```

Команда `presentations:cleanup-uploads` выполняется каждый час и удаляет
временные данные загрузок, которые не были завершены за 24 часа.

## Резервное копирование и свободное место

- Включите `storage/app/private/presentations` в резервную копию сервера.
- Следите за свободным местом и inode на диске.
- Ограничения приложения: 2 ГБ на файл, 5 ГБ и 10 материалов на одну
  презентацию.
- При переносе приложения копируйте базу данных и приватную директорию
  `storage/app/private/presentations` вместе.

