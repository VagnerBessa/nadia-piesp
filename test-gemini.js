const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
async function test() {
  try {
    const session = await ai.live.connect({ model: 'gemini-3.1-flash-live-preview' });
    console.log("Connected to 3.1");
    session.close();
  } catch(e) {
    console.log("Error 3.1", e.message);
  }
}
test();
