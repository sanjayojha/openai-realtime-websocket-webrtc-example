# OpenAI Realtime API Demonstration with WebSocket and WebRTC

This repository contains two examples of connecting to the OpenAI Realtime API using WebSocket and WebRTC on the client side (browser). Both examples allow you to have voice conversations with an LLM about planning a Christmas party. The applications generate real-time transcriptions of both the AI's responses and your speech, which can be used for further processing in your application.

**Note:** We recommend using Chrome browser when testing these applications.

## Architecture

The examples use a PHP backend to generate ephemeral (temporary) tokens for creating secure sessions. The PHP code is basic and serves as an example, you can use any backend technology (Python, Node.js, Go, etc.) to generate these temporary tokens.

**Important:** This application must run in a secure environment with HTTPS enabled.

## Requirements

The only requirement is that your OpenAI API key is loaded as an environment variable with the key `OPENAI_API_KEY`.

```bash
export OPENAI_API_KEY='your-api-key-here'
```

## Running the Examples

### WebSocket Example

```
https://localhost/websocket-chat.html
```

### WebRTC Example

```
https://localhost/webrtc-chat.html
```

## Implementation Notes

### Recording API

-   The JavaScript code uses the `MediaRecorder` Web API to record audio and video. You can completely remove this functionality if you don't need to record the user's video and audio.

### WebRTC Connection Methods

-   We can connect to the OpenAI Realtime WebRTC API using either ephemeral API keys or the new unified interface.
-   This implementation uses **ephemeral API keys**.
-   To see the unified interface implementation, check the file `openai-realtime-webrtc-alt.js`.
-   If you are using unified interface, see the `set-rtc-session.php` file. It is used to send necessary data and establish the connection.

### WebSocket vs WebRTC

-   **We recommend using WebSocket** if you want more granular control over audio input and output flow.
-   The WebSocket API provides more client-side events that allow you to control when to send audio and when to stream it.
-   You can achieve a similar experience with WebRTC by muting/unmuting audio tracks and disabling Voice Activity Detection (VAD) by setting `turn_detection` to `null`.

### Documentation Issues

#### WebRTC Connection Configuration

The current OpenAI Realtime documentation (as of this writing) about connecting to the server via WebRTC using ephemeral tokens appears to be incorrect:

-   Documentation: https://platform.openai.com/docs/guides/realtime-webrtc#connecting-to-the-server
-   **Issue:** You need to send the session config with at least the model specified along with the SDP.
-   **Solution:** See `openai-realtime-webrtc.js` for the correct implementation.

#### Voice Activity Detection (VAD)

The VAD guide in the OpenAI Realtime documentation also appears to be incorrect:

-   Documentation: https://platform.openai.com/docs/guides/realtime-vad
-   **Issue:** The `turn_detection` key should be a property of the `audio.input` object, not the `session` object.
-   **Solution:** Check the API reference for correct usage.

### Voice Activity Detection (VAD) Configuration

Enabling and disabling VAD, along with its settings, plays a significant role in controlling audio input and output flow in your application.

**Use Cases:**

-   You can control when the AI speaks and when you speak by tweaking VAD values.
-   **Disable VAD** if you want to:
    -   Send audio only at specific events (e.g., button click)
    -   Play incoming audio at specific events (e.g., when you're done speaking)
    -   Have more explicit control over the conversation flow

## Getting Started

1. Set your OpenAI API key as an environment variable
2. Ensure HTTPS is configured on your server
3. Open either `websocket-chat.html` or `webrtc-chat.html` in Chrome
4. Allow microphone and camera permissions when prompted
5. Click "Start Recording" to begin the conversation
6. Click "Stop Recording" when you want the AI to respond

## Troubleshooting

-   **HTTPS Required:** The application will not work without HTTPS due to browser security restrictions for accessing media devices.
-   **Browser Compatibility:** Chrome is recommended for the best experience.
-   **Audio Issues:** Ensure your microphone is properly connected and browser permissions are granted.

## License

This project is for demonstration purposes. Please review OpenAI's usage policies and terms of service before deploying to production.
