<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

use App\Http\Controllers\GmailController;

Route::get('/auth/google', [GmailController::class, 'redirectToGoogle']);
Route::get('/auth/google/callback', [GmailController::class, 'handleCallback']);
Route::get('/fetch-emails', [GmailController::class, 'fetchEmails']);
Route::get('/emails', function () {
    return \App\Models\Email::latest()->get();
});
Route::get('/thread/{thread}', function ($thread) {
    return \App\Models\Email::where('thread_id', $thread)->get();
});
Route::post('/reply', [GmailController::class, 'reply']);