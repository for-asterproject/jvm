<?php

return [
    'max_attachments' => 10,
    'max_file_size' => 2 * 1024 * 1024 * 1024,
    'max_total_size' => 5 * 1024 * 1024 * 1024,
    'chunk_size' => 16 * 1024 * 1024,
    'parallel_uploads' => 2,
    'pending_upload_ttl_hours' => 24,

    'extensions' => [
        'pdf' => ['media_type' => 'document', 'mime_type' => 'application/pdf'],
        'ppt' => ['media_type' => 'document', 'mime_type' => 'application/vnd.ms-powerpoint'],
        'pptx' => ['media_type' => 'document', 'mime_type' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
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
