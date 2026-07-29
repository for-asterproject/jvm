<?php

return [
    'max_attachments' => 3,
    'max_file_size' => 20 * 1024 * 1024,
    'chunk_size' => 16 * 1024 * 1024,
    'parallel_uploads' => 1,
    'pending_upload_ttl_hours' => 24,

    'extensions' => [
        'pdf' => ['media_type' => 'document', 'mime_type' => 'application/pdf'],
        'doc' => ['media_type' => 'document', 'mime_type' => 'application/msword'],
        'docx' => ['media_type' => 'document', 'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'xls' => ['media_type' => 'document', 'mime_type' => 'application/vnd.ms-excel'],
        'xlsx' => ['media_type' => 'document', 'mime_type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'zip' => ['media_type' => 'archive', 'mime_type' => 'application/zip'],
        'jpg' => ['media_type' => 'image', 'mime_type' => 'image/jpeg'],
        'jpeg' => ['media_type' => 'image', 'mime_type' => 'image/jpeg'],
        'png' => ['media_type' => 'image', 'mime_type' => 'image/png'],
        'webp' => ['media_type' => 'image', 'mime_type' => 'image/webp'],
        'mp4' => ['media_type' => 'video', 'mime_type' => 'video/mp4'],
        'webm' => ['media_type' => 'video', 'mime_type' => 'video/webm'],
        'mov' => ['media_type' => 'video', 'mime_type' => 'video/quicktime'],
    ],
];
