// src/utils/rrf.js

/**
 * Reciprocal Rank Fusion (RRF)
 * Combines multiple ranked result lists into a single ranked list.
 *
 * @param {Array<{ type: string, query: string, docs: Array }>} results
 * @param {Object} options
 * @param {number} options.k - Constant score damper (default 60)
 * @param {number} options.topK - Number of top documents to keep (default 5)
 * @returns {Array<Object>} Fused documents
 */
export function reciprocalRankFusion(
    results,
    { k = 60, topK = 5 } = {}
) {
    const fusedScores = new Map();

    for (const searchResult of results) {
        const docs = searchResult.docs ?? [];

        docs.forEach((doc, index) => {
            const rank = index + 1;
            const metadata = doc.metadata || {};

            // Unique fallback key per document/chunk
            const id =
                doc.id ??
                `${metadata.source || metadata.sourceUrl}:${metadata.startSeconds || metadata.loc?.pageNumber}:${doc.pageContent}`;

            if (!fusedScores.has(id)) {
                fusedScores.set(id, {
                    id,
                    score: 0,
                    retrievalType: metadata.retrievalType || "vector",
                    sourceType: metadata.sourceType || "unknown",
                    sourceUrl: metadata.sourceUrl || metadata.source || "Unknown Source",
                    title: metadata.title || "Document Source",
                    author: metadata.author || null,
                    videoId: metadata.videoId || null,
                    startSeconds: metadata.startSeconds ?? metadata.loc?.pageNumber ?? 0,
                    pageContent: doc.pageContent,
                    document: doc,
                    retrievedBy: [],
                });
            }

            const current = fusedScores.get(id);

            // RRF Formula: 1 / (k + rank)
            current.score += 1 / (k + rank);

            current.retrievedBy.push({
                type: searchResult.type,
                query: searchResult.query,
                rank,
            });
        });
    }

    // Sort descending by RRF score and slice topK
    return [...fusedScores.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}

export default reciprocalRankFusion;