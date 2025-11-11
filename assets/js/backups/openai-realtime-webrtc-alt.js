import { playAudioChunk } from "./audio-playback.js";
import { appendTranscriptText, startNewTranscriptParagraph, appendUserTranscriptText, startNewUserTranscriptParagraph } from "./ui-handler.js";

// Browser js module codes
let cachedTokenData = null;

// Fetch ephemeral OpenAI API key from the server
const fetchOpenAIKey = async (forceRefresh = false) => {
    try {
        // Check if we have a valid cached token
        if (!forceRefresh && cachedTokenData) {
            const currentTime = Math.floor(Date.now() / 1000);
            // Add a buffer of 3 seconds before expiry
            if (cachedTokenData.expiry > currentTime + 3) {
                console.log("Using cached OpenAI token");
                return cachedTokenData;
            }
        }

        console.log("Fetching new OpenAI token");

        const response = await fetch("ajax/get-openai-key.php", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        });
        if (!response.ok) {
            throw new Error("Failed to fetch OpenAI API key");
        }
        const data = await response.json();
        if (data.success) {
            cachedTokenData = { key: data.token, expiry: data.expiry };
            return cachedTokenData;
        } else {
            throw new Error("Failed to get session token");
        }
    } catch (error) {
        console.error("Error fetching OpenAI API key:", error);
        return null;
    }
};

const isTokenValid = () => {
    if (!cachedTokenData) return false;
    const currentTime = Math.floor(Date.now() / 1000);
    // Add a buffer of 3 seconds before expiry
    return cachedTokenData.expiry > currentTime + 3;
};

export const clearTokenCache = () => {
    cachedTokenData = null;
};

export const webRtcConnection = async (stream) => {
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

        const sdpResponse = await fetch("ajax/set-rtc-session.php", {
            method: "POST",
            body: offer.sdp,
            headers: {
                "Content-Type": "application/sdp",
                "X-Requested-With": "XMLHttpRequest",
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
        await new Promise((resolve) => {
            dataChannel.onopen = () => {
                console.log("Data channel opened");
                resolve();
            };
        });

        // events handling
        dataChannel.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log("Received response from WebRTC OpenAI connection:", data);
        };

        console.log("WebRTC connection established with OpenAI Realtime API");
        await initializeRealtime(dataChannel);
        return { peerConnection, dataChannel };
    } catch (error) {
        console.error("Error setting up WebRTC connection:", error);
        return null;
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
                model: "gpt-realtime-mini",
                output_modalities: ["audio"], // Lock the output to audio (set to ["text"] if you want text without audio)
                instructions: "You are a helpful assistant. Going to talk about upcoming Christmas plans. Ask questions and be engaging. Keep responses concise.",
                audio: {
                    input: {
                        //Note: the turn_detection setting is oudated in openAI realtime docs (https://platform.openai.com/docs/guides/realtime-vad). Check https://platform.openai.com/docs/api-reference/realtime-client-events/session/update for latest
                        turn_detection: {
                            type: "semantic_vad",
                            eagerness: "low",
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

        rtcDataChannel.send(JSON.stringify(initEvent));
        console.log("WebRTC openAI Realtime initialized with session update");
    } catch (error) {
        console.error("Error initializing WebRTC OpenAI Realtime:", error);
    }
};
