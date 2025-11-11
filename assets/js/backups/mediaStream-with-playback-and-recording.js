// Browser JS module codes

// getMediaStream (mic and camera access)
export const getMediaStream = async (options) => {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("MediaDevices API is not supported in this browser.");
        }
        if (!options) {
            options = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user", // Front camera
                },
                audio: {
                    sampleRate: 24000,
                    channelCount: 1, // Mono audio for OpenAI Realtime API
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            };
        }
        const stream = await navigator.mediaDevices.getUserMedia(options);
        return stream;
    } catch (error) {
        console.error("Error accessing media devices.", error);
        throw error;
    }
};

// stopMediaStream (stop mic and camera)
export const stopMediaStream = (stream) => {
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
    }
};

// mediaRecorder for video recording (optional - for saving video locally)
export const createMediaRecorder = async (stream, options = {}) => {
    try {
        if (!stream) {
            throw new Error("No media stream provided for MediaRecorder.");
        }
        if (typeof MediaRecorder === "undefined") {
            throw new Error("MediaRecorder API is not supported in this browser.");
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType || "")) {
            console.warn(`MIME type ${options.mimeType} is not supported. Using default settings.`);
            options = {};
        }
        const mediaRecorder = new MediaRecorder(stream, options);

        recordedChunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
            console.log("Recording stopped. Recorded blob:", blob);
        };
        mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
        };
        mediaRecorder.onstart = () => {
            console.log("MediaRecorder started");
        };

        mediaRecorder.start();
        return mediaRecorder;
    } catch (error) {
        console.error("Error creating MediaRecorder.", error);
        throw error;
    }
};

export const stopMediaRecorder = async (mediaRecorder, audioRecorder) => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    if (audioRecorder && audioRecorder.state !== "inactive") {
        audioRecorder.stop();
    }
};

export const createAudioMediaRecorder = (stream, onAudioData) => {
    try {
        if (!stream) {
            throw new Error("No media stream provided for audio recorder.");
        }
        const audioStream = new MediaStream(stream.getAudioTracks());
        const audioRecorder = new MediaRecorder(audioStream, {
            mimeType: "audio/webm;codecs=opus",
        });

        audioRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                try {
                    // Convert blob to ArrayBuffer, then to Float32Array
                    const arrayBuffer = await event.data.arrayBuffer();
                    console.log("Audio chunk ArrayBuffer:", arrayBuffer);
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                        sampleRate: 24000,
                    });
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const float32Array = audioBuffer.getChannelData(0);
                    if (onAudioData) {
                        const base64Audio = base64EncodeAudio(float32Array);
                        onAudioData(base64Audio);
                    }
                    // Close the audio context to free resources
                    await audioContext.close();
                } catch (decodeError) {
                    console.warn("Could not decode audio chunk (chunk may be incomplete):", decodeError.message);
                    // Skip this chunk and continue
                }
            }
        };
        audioRecorder.start(1000); // Collect 100ms chunks
        return audioRecorder;
    } catch (error) {
        console.error("Error creating audio MediaRecorder.", error);
        throw error;
    }
};

export const createAudioProcessor = async (stream, onAudioData) => {
    try {
        if (!stream) {
            throw new Error("No media stream provided for audio processor.");
        }

        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 24000,
        });

        console.log("Loading AudioWorklet module...");

        // Load the audio worklet module
        await audioContext.audioWorklet.addModule("/assets/js/audio-processor.worklet.js");

        console.log("AudioWorklet module loaded successfully");

        const audioStream = new MediaStream(stream.getAudioTracks());
        const sourceNode = audioContext.createMediaStreamSource(audioStream);
        const workletNode = new AudioWorkletNode(audioContext, "audio-processor");

        // Listen for audio data from the worklet
        workletNode.port.onmessage = (event) => {
            const float32Array = event.data.audio;
            if (onAudioData && float32Array.length > 0) {
                const base64Audio = base64EncodeAudio(float32Array);
                onAudioData(base64Audio);
            }
        };

        // Connect the nodes
        sourceNode.connect(workletNode);

        console.log("AudioProcessor connected and running");

        return { audioContext, workletNode, sourceNode };
    } catch (error) {
        console.error("Error creating audio processor.", error);
        throw error;
    }
};

export const stopAudioProcessor = async (audioProcessor) => {
    if (audioProcessor) {
        const { audioContext, workletNode, sourceNode } = audioProcessor;
        if (sourceNode) sourceNode.disconnect();
        if (workletNode) workletNode.disconnect();
        if (audioContext && audioContext.state !== "closed") {
            await audioContext.close();
        }
        console.log("AudioProcessor stopped");
    }
};

// Converts Float32Array of audio data to PCM16 ArrayBuffer
export const floatTo16BitPCM = (float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
};

// Converts a Float32Array to base64-encoded PCM16 data
export const base64EncodeAudio = (float32Array) => {
    const arrayBuffer = floatTo16BitPCM(float32Array);
    let binary = "";
    let bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000; // 32KB chunk size
    for (let i = 0; i < bytes.length; i += chunkSize) {
        let chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
};

// Decode base64 PCM16 audio back to Float32Array
export const base64DecodeAudio = (base64String) => {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const dataView = new DataView(bytes.buffer);
    const float32Array = new Float32Array(bytes.length / 2);
    for (let i = 0; i < float32Array.length; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / (int16 < 0 ? 0x8000 : 0x7fff);
    }
    return float32Array;
};

// Playback recorded audio chunks
export const playbackAudio = async (base64Chunks) => {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 24000,
        });

        // Combine all chunks into one Float32Array
        let totalLength = 0;
        const decodedChunks = base64Chunks.map((chunk) => {
            const decoded = base64DecodeAudio(chunk);
            totalLength += decoded.length;
            return decoded;
        });

        const combinedAudio = new Float32Array(totalLength);
        let offset = 0;
        decodedChunks.forEach((chunk) => {
            combinedAudio.set(chunk, offset);
            offset += chunk.length;
        });

        // Create audio buffer
        const audioBuffer = audioContext.createBuffer(1, combinedAudio.length, 24000);
        audioBuffer.copyToChannel(combinedAudio, 0);

        // Play the audio
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);

        console.log("Playing back recorded audio...");

        return { audioContext, source };
    } catch (error) {
        console.error("Error playing back audio:", error);
        throw error;
    }
};

// Global variables
let mediaStream = null;
let mediaRecorder = null;
let audioProcessor = null;
let recordedChunks = [];
let recordedAudioChunks = []; // Store base64 audio chunks for playback

// Initialize media stream on page load
window.addEventListener("load", async () => {
    try {
        // Get media stream (video + audio)
        mediaStream = await getMediaStream();
        const startRecordingButton = document.getElementById("startRecording");
        const stopRecordingButton = document.getElementById("stopRecording");
        const playbackButton = document.getElementById("playbackAudio");
        if (playbackButton) playbackButton.disabled = true;
        stopRecordingButton.disabled = true;

        if (startRecordingButton) {
            startRecordingButton.addEventListener("click", async () => {
                // Clear previous recording
                recordedAudioChunks = [];
                // start video recording
                mediaRecorder = await createMediaRecorder(mediaStream, {
                    mimeType: "video/webm;codecs=opus",
                });
                // start audio processing with AudioWorklet
                audioProcessor = await createAudioProcessor(mediaStream, (base64Audio) => {
                    console.log("Audio data chunk (base64):", base64Audio.substring(0, 50) + "...");
                    // Store the audio chunk
                    recordedAudioChunks.push(base64Audio);
                    // Send to your WebSocket/API here
                });
                // disable start button to prevent multiple clicks
                startRecordingButton.disabled = true;
                // enable stop button
                if (stopRecordingButton) {
                    stopRecordingButton.disabled = false;
                }
            });
        }

        if (stopRecordingButton) {
            stopRecordingButton.addEventListener("click", async () => {
                if (mediaRecorder && mediaRecorder.state !== "inactive") {
                    mediaRecorder.stop();
                }
                await stopAudioProcessor(audioProcessor);
                // disable stop button
                stopRecordingButton.disabled = true;
                // enable start button again
                if (startRecordingButton) {
                    startRecordingButton.disabled = false;
                }

                // enable playback button
                if (playbackButton) {
                    playbackButton.disabled = false;
                }
                console.log(`Recorded ${recordedAudioChunks.length} audio chunks`);
            });
        }

        if (playbackButton) {
            playbackButton.addEventListener("click", async () => {
                if (recordedAudioChunks.length > 0) {
                    await playbackAudio(recordedAudioChunks);
                } else {
                    console.warn("No audio chunks to playback");
                }
            });
        }

        // Display video in the video element
        const videoElement = document.getElementById("userVideo");
        if (videoElement) {
            videoElement.srcObject = mediaStream;
            console.log("Video stream connected to video element");
        }
    } catch (error) {
        console.error("Could not get media stream on load.", error);
    }
});
