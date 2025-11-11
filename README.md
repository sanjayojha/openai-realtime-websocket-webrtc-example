# OpenAI realtime demonstration with websocket and webrtc using client side JavaScript

This repository contains two examples of connecting to openAI realtime API using websocket and webrtc on client (for example browser). These two examples let you to talk with LLM which helps you to plan Christmas party. Along with talking they also generates transcription of both side audios(What LLM said and what you said), so the transcription can be used for further use in your application if needed. We recommend using chrome while testing these application.

We have used PHP backend to generate an ephemeral (temporary) token so that we can create sessions. PHP code is very basic and just for example, you can use any other backend technology like Python, Node, or Go to generate these temporary tokens. Please note that you can run this app in secure enviornment only, so make sure https is active.

## Requirement

The only requirement is that openAI api key is loaded in enviornment varaibles as key of `OPENAI_API_KEY`

## WebSocket example

```shell
https://localhost/websocket-chat.html
```

## WebRTC example

```shell
https://localhost/webrtc-chat.html
```

## Notes

-   In JavaScript codes I am using `MediaRecorder` Web API to record audio and video. You can completely remove this part if you do not required the recording of user's video and audio.
-   We can connect to openAI realtime webRTC either using ephemeral API keys or via the new unified interface. We have used ephemeral API keys. To see the usage of unified interface, check the file `openai-realtime-webrtc-alt.js` for implementation. We have used `set-rtc-session.php` to send necessary data and establish a connection.
-   We recommend to use webSocket if you want to control the audio input and output flow in a more granular way. webSocket API provides much more client side events which we can use to when to send audio and when to stream it. We can acheive almost smiliar expereince with webRTC by muting and unmuting the audio tracks and by disabling voice activity detection (VAD) (set `turn_detection` to `null`).
-   The current (as of writing these notes) the openAI realtime documenation about connecting to server (https://platform.openai.com/docs/guides/realtime-webrtc#connecting-to-the-server) via webRTC using ephermal tokens seems to be incorrect, you need to send session config with at least model specified along with sdp ( see `openai-realtime-webrtc.js` for example).
-   The VAD guide in openAI realtime also seems to be wrong (https://platform.openai.com/docs/guides/realtime-vad). the event key `turn_detection` should be inside should be inside key of object `audio.input` and not the `session`. Check the API reference for correct usage.
-   Enabling and disabling of VAD and its setting play sigificant role if you want to control the the input and output audio flow or stream in your application. You can decide when AI speak and when you speak by tweaking these values. We recommend to disable it if you want to send audio only at a certain event (for example button click) and play the incoming audio at a certain event (for example when you done with speaking and now allow AI to respond).
