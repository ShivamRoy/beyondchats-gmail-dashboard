<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Email extends Model
{
    protected $fillable = [
        'gmail_id',
        'thread_id',
        'sender',
        'receiver',
        'subject',
        'body',
        'attachments',
    ];

    protected $casts = [
        'attachments' => 'array',
    ];
}
