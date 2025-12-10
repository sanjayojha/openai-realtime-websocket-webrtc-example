import { appendTranscriptText, startNewTranscriptParagraph, appendUserTranscriptText, startNewUserTranscriptParagraph } from "./ui-handler.js";
import { fetchOpenAIKey, isTokenValid, invalidateToken } from "./session-manager.js";

// Browser js module codes
let rtcDataChannelGlobal = null;
let peerConnectionGlobal = null;

export const webRtcConnection = async (stream, fullyLoadedCallback = null) => {
    try {
        if (!stream) {
            throw new Error("Media stream is required for WebRTC connection");
        }
        const keyData = await fetchOpenAIKey(!isTokenValid);
        if (!keyData) {
            throw new Error("Could not retrieve OpenAI API key");
        }

        const ephemeralOpenAIKey = keyData.key;
        // Create a peer connection
        const peerConnection = new RTCPeerConnection();

        //setup audio element to play incoming audio
        const audioElement = { current: null };
        audioElement.current = document.createElement("audio");
        audioElement.current.autoplay = true;
        peerConnection.ontrack = (event) => {
            audioElement.current.srcObject = event.streams[0];
            console.log("Received remote track and playing audio");
        };

        // Add local audio stream tracks to the peer connection
        const audioTracks = stream.getAudioTracks()[0];
        if (!audioTracks) {
            throw new Error("No audio tracks found in the media stream for WebRTC");
        }
        peerConnection.addTrack(audioTracks, stream);

        const dataChannel = peerConnection.createDataChannel("oai-events");

        // Start the session using the Session Description Protocol (SDP)
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const sessionConfig = {
            model: "gpt-realtime-mini",
        };

        const formData = new FormData();
        formData.append("sdp", offer.sdp);
        formData.append("session", JSON.stringify(sessionConfig));

        const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
            method: "POST",
            body: formData,
            headers: {
                Authorization: `Bearer ${ephemeralOpenAIKey}`,
            },
        });

        if (!sdpResponse.ok) {
            const errorText = await sdpResponse.text();
            throw new Error(`SDP exchange failed: ${sdpResponse.status} - ${errorText}`);
        }

        const answer = {
            type: "answer",
            sdp: await sdpResponse.text(),
        };
        await peerConnection.setRemoteDescription(answer);

        // Wait for data channel to open
        // await new Promise((resolve) => {
        //     dataChannel.onopen = () => {
        //         console.log("Data channel opened");
        //         resolve();
        //     };
        // });
        dataChannel.onopen = async () => {
            console.log("Data channel opened");
            await initializeRealtime(dataChannel);
            rtcDataChannelGlobal = dataChannel;
            peerConnectionGlobal = peerConnection;
            if (fullyLoadedCallback) {
                fullyLoadedCallback();
            }
        };

        // events handling
        dataChannel.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log("Received response from WebRTC OpenAI connection:", data);

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
        };

        dataChannel.onerror = (error) => {
            console.error("Data channel error:", error);
        };

        dataChannel.onclose = () => {
            console.log("Data channel closed");
            invalidateToken();
        };

        console.log("WebRTC connection established with OpenAI Realtime API");
    } catch (error) {
        console.error("Error setting up WebRTC connection:", error);
    }
};

const initializeRealtime = async (rtcDataChannel) => {
    try {
        if (!rtcDataChannel) {
            throw new Error("RTC Data Channel is required to initialize Realtime session");
        }
        const initEvent = {
            type: "session.update",
            session: {
                type: "realtime",
                output_modalities: ["audio"], // Lock the output to audio (set to ["text"] if you want text without audio)
                instructions: "You are a helpful assistant. Going to talk about upcoming Christmas plans. Ask questions and be engaging. Keep responses concise.",
                audio: {
                    input: {
                        //Note: the turn_detection setting is oudated in openAI realtime docs (https://platform.openai.com/docs/guides/realtime-vad). Check https://platform.openai.com/docs/api-reference/realtime-client-events/session/update for latest
                        // turn_detection: {
                        //     type: "semantic_vad",
                        //     eagerness: "low",
                        //     interrupt_response: false, // you can set to true if you want to interrupt response on user speech
                        //     create_response: false, // set to true if you want to create response automatically on turn end
                        // },
                        turn_detection: null,
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

        rtcDataChannel.send(JSON.stringify(initEvent));
        console.log("WebRTC openAI Realtime initialized with session update");
    } catch (error) {
        console.error("Error initializing WebRTC OpenAI Realtime:", error);
    }
};

export const createResponse = async () => {
    try {
        if (!rtcDataChannelGlobal) {
            throw new Error("WebRTC is not open");
        }
        rtcDataChannelGlobal.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        rtcDataChannelGlobal.send(JSON.stringify({ type: "response.create" }));
        console.log("Response create event sent to WebRTC OpenAI Realtime");
    } catch (error) {
        console.error("Error sending audio send event to WebRTC OpenAI Realtime:", error);
    }
};

export const clearAudioBuffer = async () => {
    try {
        if (!rtcDataChannelGlobal) {
            throw new Error("WebRTC is not open");
        }
        rtcDataChannelGlobal.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
        console.log("Cleared audio buffer in webRTC OpenAI Realtime");
    } catch (error) {
        console.error("Error clearing audio buffer in webRTC OpenAI Realtime:", error);
    }
};
