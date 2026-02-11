
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getQuestInsights = async (destination: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short RPG-style traffic or status update for a quest to ${destination}. 
      Include a short title and a descriptive status message (e.g., "Heavy traffic on Dragon Bridge").
      Keep it very concise (max 15 words).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            status: { type: Type.STRING },
            timeEstimate: { type: Type.STRING }
          },
          required: ["title", "status", "timeEstimate"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};
