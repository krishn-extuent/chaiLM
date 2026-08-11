// src/prompt/buildPrompt.js

import { systemInstructions } from "./systemPrompt.js";
import { format as formatVector } from "./vectorFormatter.js";

const formatters = {
    vector: formatVector,
};

/**
 * Builds the final structured system prompt from retrieved context blocks
 */
export function buildPrompt(retrievedContext = []) {
    const contexts = Array.isArray(retrievedContext)
        ? retrievedContext
        : [retrievedContext];

    // Group contexts by retrievalType (vector, sql, mongo, etc.)
    const groupedContexts = contexts.reduce((acc, context) => {
        const type = context?.retrievalType || "vector";
        acc[type] ??= [];
        acc[type].push(context);
        return acc;
    }, {});

    const formattedContext = Object.entries(groupedContexts)
        .map(([type, docs]) => formatters[type]?.(docs))
        .filter(Boolean)
        .join("\n\n");

    return `${systemInstructions}

Retrieved Context:

${formattedContext}`;
}

export default buildPrompt;