<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Google_Client;
use Google_Service_Gmail;
use Google_Service_Gmail_Message;
use App\Models\Email;

class GmailController extends Controller
{
    public function redirectToGoogle()
    {
        $client = new Google_Client();

        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect_uri'));

        $client->addScope(Google_Service_Gmail::GMAIL_READONLY);
        $client->addScope(Google_Service_Gmail::GMAIL_SEND);

        return redirect($client->createAuthUrl());
    }

    public function handleCallback(Request $request)
    {
        $client = new Google_Client();

        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect_uri'));

        $token = $client->fetchAccessTokenWithAuthCode($request->code);

        $frontendUrl = config('services.google.frontend_url', 'http://localhost:3000');
        return redirect($frontendUrl . '?access_token=' . urlencode($token['access_token'] ?? ''));
    }

    public function fetchEmails(Request $request)
    {
        $client = new Google_Client();

        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect_uri'));

        $client->setAccessToken($request->token);

        $service = new Google_Service_Gmail($client);

        $days = $request->days ?? 7;
        $query = 'after:' . date('Y/m/d', strtotime("-$days days"));

        $messages = $service->users_messages->listUsersMessages('me', [
            'q' => $query,
            'maxResults' => 20
        ]);

        $emailData = [];

        foreach ($messages->getMessages() as $message) {

            $msg = $service->users_messages->get('me', $message->getId());

            $payload = $msg->getPayload();
            $headers = $payload->getHeaders();

            $subject = '';
            $from = '';

            $to = '';

            foreach ($headers as $header) {

                if ($header->getName() == 'Subject') {
                    $subject = $header->getValue();
                }

                if ($header->getName() == 'From') {
                    $from = $header->getValue();
                }

                if ($header->getName() == 'To') {
                    $to = $header->getValue();
                }
            }

            $attachments = [];
            $parts = $payload->getParts();
            if ($parts) {
                foreach ($parts as $part) {
                    if ($part->getFilename()) {
                        $attachments[] = ['filename' => $part->getFilename()];
                    }
                }
            }

            Email::updateOrCreate(
                ['gmail_id' => $msg->getId()],
                [
                    'thread_id' => $msg->getThreadId(),
                    'sender' => $from,
                    'receiver' => $to,
                    'subject' => $subject,
                    'attachments' => $attachments,
                ]
            );

            $emailData[] = [
                'id' => $msg->getId(),
                'thread_id' => $msg->getThreadId(),
                'subject' => $subject,
                'sender' => $from,
                'receiver' => $to,
                'attachments' => $attachments,
            ];
        }

        return response()->json($emailData);
    }

    public function getThread($threadId)
    {
        return Email::where('thread_id', $threadId)->get();
    }

    public function reply(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'thread_id' => 'required',
            'to' => 'required|string',
            'subject' => 'required|string',
            'message' => 'required|string',
        ]);

        $client = new Google_Client();
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect_uri'));
        $client->setAccessToken($request->token);

        $service = new Google_Service_Gmail($client);

        $thread = Email::where('thread_id', $request->thread_id)->first();
        if (!$thread) {
            return response()->json(['error' => 'Thread not found'], 404);
        }

        $to = preg_replace('/.*<(.+?)>.*/', '$1', $request->to);
        $subject = $request->subject;
        if (stripos($subject, 'Re:') !== 0) {
            $subject = 'Re: ' . $subject;
        }

        $mime = "To: {$to}\r\n";
        $mime .= "Subject: {$subject}\r\n";
        $mime .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $mime .= "\r\n";
        $mime .= $request->message;

        $raw = rtrim(strtr(base64_encode($mime), '+/', '-_'), '=');

        $message = new Google_Service_Gmail_Message();
        $message->setRaw($raw);
        $message->setThreadId($request->thread_id);

        $sent = $service->users_messages->send('me', $message);

        return response()->json(['success' => true, 'id' => $sent->getId()]);
    }
}