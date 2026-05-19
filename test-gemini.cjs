const { GoogleGenAI, Modality } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
async function test() {
  try {
    const session = await ai.live.connect({ 
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
            onmessage: (msg) => {
                if (msg.serverContent && msg.serverContent.modelTurn) {
                    msg.serverContent.modelTurn.parts.forEach((p, i) => {
                        if (p.inlineData) console.log(`Part ${i}: AUDIO (${p.inlineData.data.length} bytes)`);
                        if (p.text) console.log(`Part ${i}: TEXT (${p.text})`);
                    });
                }
            }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
    });
    console.log("Connected to 2.5 with Audio config");
    session.sendRealtimeInput({ clientContent: { turns: [{ parts: [{ text: "Hello, can you reply with audio?" }] }], turnComplete: true } });
    
    setTimeout(() => { session.close(); console.log("Done"); }, 5000);
  } catch(e) {
    console.log("Error 2.5", e.message);
  }
}
test();
