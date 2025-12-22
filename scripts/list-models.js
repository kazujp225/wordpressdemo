const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Success with gemini-1.5-flash");
    
    try {
      const model2 = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model2.generateContent("test");
      console.log("Success with gemini-2.0-flash");
    } catch (e) {
      console.log("Failed gemini-2.0-flash:", e.message);
    }
  } catch (e) {
    console.error(e);
  }
}
run();
