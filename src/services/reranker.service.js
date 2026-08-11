// src/services/reranker.service.js
import { CohereClient } from "cohere-ai";
import { config } from "../config/env.js";

const cohere = new CohereClient({
    token: config.cohere?.apiKey,
});

/**
 * Cross-Encoder Reranker using Cohere Rerank v3.5
 * Scores true semantic relevance between query and candidate text.
 */
export async function rerankDocuments(query, candidates, topN = 5) {
    if (!candidates || candidates.length === 0) return [];

    try {
        const response = await cohere.rerank({
            model: "rerank-v3.5",
            query: query,
            documents: candidates.map((c) => ({ text: c.pageContent })),
            topN: topN,
        });

        return response.results.map((res) => ({
            ...candidates[res.index],
            rerankScore: res.relevanceScore,
        }));
    } catch (error) {
        console.error("Reranker error, falling back to top candidates:", error);
        return candidates.slice(0, topN);
    }
}