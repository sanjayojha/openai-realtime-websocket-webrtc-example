// Shared session and token management

let cachedTokenData = null;

// Fetch ephemeral OpenAI API key from the server
export const fetchOpenAIKey = async (forceRefresh = false) => {
    try {
        // Check if we have a valid cached token
        if (!forceRefresh && cachedTokenData) {
            const currentTime = Math.floor(Date.now() / 1000);
            // Add a buffer of 30 seconds before expiry
            if (cachedTokenData.expiry > currentTime + 30) {
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

export const isTokenValid = () => {
    if (!cachedTokenData) return false;
    const currentTime = Math.floor(Date.now() / 1000);
    // Add a buffer of 30 seconds before expiry
    return cachedTokenData.expiry > currentTime + 30;
};

export const invalidateToken = () => {
    cachedTokenData = null;
};

// currently not used, but can be useful for future enhancements
export const getSessionConfig = () => ({
    type: "realtime",
    output_modalities: ["audio"],
    instructions: "You are a helpful assistant. Going to talk about upcoming Christmas plans. Ask questions and be engaging. Keep responses concise.",
    audio: {
        input: {
            transcription: {
                language: "en",
                model: "gpt-4o-mini-transcribe",
                prompt: "It is an Indian English audio having a casual conversation about Christmas plans.",
            },
        },
    },
});
