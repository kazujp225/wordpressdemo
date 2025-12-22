const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

async function run() {
  try {
    const list = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("1.5 Flash OK");
    try {
      const g2 = await genAI.getGenerativeModel({ model: "gemini-2.0-flash" }).generateContent("ping");
      console.log("2.0 Flash OK");
    } catch(e) { console.log("2.0 Flash Failed:", e.message); }
  } catch (e) {
    console.error(e);
  }
}
run();
