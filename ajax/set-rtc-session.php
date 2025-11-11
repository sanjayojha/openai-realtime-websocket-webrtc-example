<?php

if (strtolower($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') == 'xmlhttprequest') {
    // Get the SDP from the request body
    $inputSDP = file_get_contents('php://input');

    // Session configuration (equivalent to sessionConfig in Node.js)
    $sessionConfig = json_encode([
        'type' => 'realtime',
        'model' => 'gpt-realtime-mini',
        'audio' => [
            'output' => [
                'voice' => 'marin'
            ]
        ]
    ]);

    // Create multipart/form-data boundary
    $boundary = '----WebKitFormBoundary' . uniqid();

    // Build multipart form data
    $formData = '';

    // Add SDP field
    $formData .= "--{$boundary}\r\n";
    $formData .= "Content-Disposition: form-data; name=\"sdp\"\r\n\r\n";
    $formData .= $inputSDP . "\r\n";

    // // Add session field
    $formData .= "--{$boundary}\r\n";
    $formData .= "Content-Disposition: form-data; name=\"session\"\r\n\r\n";
    $formData .= $sessionConfig . "\r\n";

    // End boundary
    $formData .= "--{$boundary}--\r\n";

    // Initialize cURL
    $ch = curl_init('https://api.openai.com/v1/realtime/calls');
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: multipart/form-data; boundary=' . $boundary,
        'Authorization: Bearer ' . getenv('OPENAI_API_KEY')
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $formData);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $result = curl_exec($ch);

    if (curl_errno($ch)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to generate token: ' . curl_error($ch)]);
    } else {
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($httpCode >= 200 && $httpCode < 300) {
            // Send back the SDP received from OpenAI
            header('Content-Type: application/sdp');
            echo $result;
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to generate token', 'details' => $result]);
        }
    }
    curl_close($ch);
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
}

exit;
