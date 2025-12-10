import { playAudioChunk } from "./audio-playback.js";
import { appendTranscriptText, startNewTranscriptParagraph, appendUserTranscriptText, startNewUserTranscriptParagraph } from "./ui-handler.js";
import { fetchOpenAIKey, isTokenValid, invalidateToken } from "./session-manager.js";

// Browser js module codes
let openAISocketConnection = null;

export const openAISocket = async (fullyLoadedCallback = null) => {
    const keyData = await fetchOpenAIKey(!isTokenValid);
    if (!keyData) {
        throw new Error("Could not retrieve OpenAI API key");
    }

    const ephemeralOpenAIKey = keyData.key;
    const socket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-realtime-mini", ["realtime", "openai-insecure-api-key." + ephemeralOpenAIKey]);

    socket.onopen = async () => {
        console.log("Connected to OpenAI Realtime API");
        // Initialize the realtime session
        await initializeRealtime(socket);
        openAISocketConnection = socket;
        if (fullyLoadedCallback) {
            fullyLoadedCallback();
        }
    };
    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
    socket.onclose = (event) => {
        console.log("WebSocket connection closed:", event);
        // Optionally invalidate the cached token on socket close
        invalidateToken();
    };

    // single message handler
    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("Received response from OpenAI websocket:", data);

        //handle audio delta and audio transcript delta and stream them
        if (data.type === "response.output_audio.delta") {
            //PCM
            const audioChunkBase64 = data.delta;
            await playAudioChunk(audioChunkBase64);
        }

        // when output_modalities: ["audio"] is set in initializeRealtime, handle audio response transcripts
        if (data.type === "response.output_audio_transcript.delta") {
            const transcriptText = data.delta;
            appendTranscriptText(transcriptText);
        }

        // when output_modalities: ["text"] is set in initializeRealtime, handle text responses
        if (data.type === "response.output_text.delta") {
            const transcriptText = data.delta;
            appendTranscriptText(transcriptText);
        }

        // lets handle user audio transcript received from openAI
        if (data.type === "conversation.item.input_audio_transcription.delta") {
            const userTranscriptText = data.delta;
            appendUserTranscriptText(userTranscriptText);
        }

        // Handle response completion
        if (data.type === "response.done") {
            console.log("Response complete");
            startNewTranscriptParagraph();
        }

        if (data.type === "conversation.item.input_audio_transcription.completed") {
            console.log("User audio transcription complete");
            startNewUserTranscriptParagraph();
        }

        //handle chat responses
        // if (data.type === "response.output_text.done") {
        //     console.log("OpenAI response:", data.text);
        //     const outputText = data.text.replace(/[—\n]/g, "").trim();

        //     window.dispatchEvent(
        //         new CustomEvent("openai-response", {
        //             detail: { text: outputText },
        //         })
        //     );
        // }
    };
};

const initializeRealtime = async (socket) => {
    try {
        if (socket.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not open");
        }
        const initEvent = {
            type: "session.update",
            session: {
                type: "realtime",
                model: "gpt-realtime-mini",
                output_modalities: ["audio"], // Lock the output to audio (set to ["text"] if you want text without audio)
                instructions: "You are a helpful assistant. Going to talk about upcoming Christmas plans. Ask questions and be engaging. Keep responses concise.",
                audio: {
                    input: {
                        //Note: the turn_detection setting is oudated in openAI realtime docs (https://platform.openai.com/docs/guides/realtime-vad). Check https://platform.openai.com/docs/api-reference/realtime-client-events/session/update for latest
                        turn_detection: {
                            type: "semantic_vad",
                            eagerness: "low",
                            interrupt_response: false, // you can set to true if you want to interrupt response on user speech
                            create_response: false, // set to true if you want to create response automatically on turn end
                        },
                        // This enables real-time transcription of user audio
                        transcription: {
                            language: "en",
                            model: "gpt-4o-mini-transcribe",
                            prompt: "It is an Indian English audio having a casual conversation about Christmas plans.",
                        },
                    },
                },
            },
        };

        socket.send(JSON.stringify(initEvent));
        console.log("OpenAI Realtime initialized with session update");
    } catch (error) {
        console.error("Error initializing OpenAI Realtime:", error);
    }
};

export const clearAudioBuffer = async () => {
    try {
        if (openAISocketConnection.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not open");
        }
        openAISocketConnection.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
        console.log("Cleared audio buffer in OpenAI Realtime");
    } catch (error) {
        console.error("Error clearing audio buffer in OpenAI Realtime:", error);
    }
};

export const bufferAudioChunk = async (base64Audio) => {
    try {
        if (openAISocketConnection.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not open");
        }
        const audioBufferEvent = {
            type: "input_audio_buffer.append",
            audio: base64Audio,
        };
        openAISocketConnection.send(JSON.stringify(audioBufferEvent));
        console.log("Sent audio chunk to OpenAI Realtime");
    } catch (error) {
        console.error("Error sending audio chunk to OpenAI Realtime:", error);
    }
};

export const createResponse = async () => {
    try {
        if (openAISocketConnection.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not open");
        }

        openAISocketConnection.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        openAISocketConnection.send(JSON.stringify({ type: "response.create" }));
        console.log("Response create event sent to OpenAI Realtime");
    } catch (error) {
        console.error("Error sending audio send event to OpenAI Realtime:", error);
    }
};
