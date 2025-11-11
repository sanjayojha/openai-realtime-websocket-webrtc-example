<?php
header('Content-Type: application/json');

if (strtolower($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') == 'xmlhttprequest') {
    // get ephemeral client secret from OpenAI

    $expiryConfig = [
        "seconds" => 600,
        "anchor" => "created_at"
    ];
    $postData = [
        "expires_after" => $expiryConfig
    ];
    $ch = curl_init('https://api.openai.com/v1/realtime/client_secrets');
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . getenv('OPENAI_API_KEY')
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, '20'); //timeout in seconds
    // curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    // curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    $result = curl_exec($ch);
    if (curl_errno($ch)) {
        $return = ['success' => false, "msg" => 'CURL ERROR: ' . curl_error($ch)];
    } else {
        $result = json_decode($result, true);
        if (isset($result['error']) && !empty($result['error'])) {
            $return = ['success' => false, 'msg' => 'error: ' . json_encode($result['error'])];
        } else {
            //$tokenData = $result['value'];
            $return = ['success' => true, 'token' => $result['value'], 'expiry' => $result['expires_at']];
        }
    }
    curl_close($ch);
} else {
    $return = ['success' => false, 'msg' => 'invalid ajax request'];
}
echo json_encode($return);
exit;
