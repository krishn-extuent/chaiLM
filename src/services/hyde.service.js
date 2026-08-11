// src/services/hyde.service.js
import OpenAI from "openai";
import { config } from "../config/env.js";

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Generates a hypothetical reference chunk.
 * Accepts optional context object (e.g., video title/topic) to anchor generic queries like "What is this video about?"
 */
export async function generateHyDeDocument(userQuery, contextHint = "") {
    try {
        const promptContext = contextHint
            ? `Topic/Title Context: "${contextHint}"\nUser Query: "${userQuery}"`
            : userQuery;

        const completion = await openai.chat.completions.create({
            model: config.openai.chatModel || "gpt-4o-mini",
            temperature: 0.3,
            messages: [
                {
                    role: "system",
                    content: `
You are an expert technical writer.
Write a 3 to 4 sentence reference excerpt that directly answers the user's query as if taken from a real transcript or document.

RULES:
1. Match the language style of the user query (English vs Hindi/Hinglish).
2. Do NOT mention URLs or make up unrelated domains (e.g., photography) if given generic prompts.
3. If context/title hints are provided, align the hypothetical answer directly with that domain.
`,
                },
                { role: "user", content: promptContext },
            ],
        });

        return completion.choices[0]?.message?.content?.trim() || userQuery;
    } catch (error) {
        console.error("HyDE generation error:", error);
        return userQuery;
    }
}