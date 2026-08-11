import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../config/env.js";
import { translateQuery } from "./llm.service.js";
import { generateHyDeDocument } from "./hyde.service.js";
import { reciprocalRankFusion } from "../utils/rrf.js";
import { rerankDocuments } from "./reranker.service.js";
import { generateStructuredRAGResponse } from "./ragGenerator.service.js";
import { formatSecondsToTimestamp } from "../utils/timestampFormatter.utils.js";
import { ChatMessage } from "../models/ChatMessage.js";

const embeddings = new OpenAIEmbeddings({
  model: config.openai.embeddingModel,
  apiKey: config.openai.apiKey,
});

export async function processQueryPipeline({ query, workspaceId, userId, selectedSourceIds = [] }) {
  // 1. Instantiate vector store
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: config.qdrant.url,
    collectionName: config.qdrant.collection,
  });

  // 2. Fetch workspace title hint for HyDE
  let sourceTitleHint = "";
  try {
    const sampleDocs = await vectorStore.similaritySearch("", 1, {
      must: [
        { key: "metadata.workspaceId", match: { value: workspaceId } },
        ...(selectedSourceIds.length > 0
          ? [{ key: "metadata.sourceUrl", match: { any: selectedSourceIds } }]
          : []),
      ],
    });

    if (sampleDocs.length > 0 && sampleDocs[0].metadata?.title) {
      sourceTitleHint = sampleDocs[0].metadata.title;
    }
  } catch (err) {
    console.warn("Title hint fetch failed:", err.message);
  }

  // 3. Parallel Expansion + HyDE
  const [translations, hydePassage] = await Promise.all([
    translateQuery(query),
    generateHyDeDocument(query, sourceTitleHint),
  ]);

  // 4. Build search requests
  const searchRequests = [
    { type: "original", query },
    { type: "rewritten", query: translations.rewritten },
    { type: "stepBack", query: translations.stepBack },
    ...(translations.subQueries || []).map((sq) => ({ type: "subQuery", query: sq })),
    { type: "hyde", query: hydePassage },
  ];

  // 5. Configure Vector Retriever
  const vectorRetriever = vectorStore.asRetriever({
    k: config.retrieval.vectorTopK || 10,
    filter: {
      must: [
        { key: "metadata.workspaceId", match: { value: workspaceId } },
        ...(selectedSourceIds.length > 0
          ? [{ key: "metadata.sourceUrl", match: { any: selectedSourceIds } }]
          : []),
      ],
    },
  });

  // 6. Execute Multi-Angle Parallel Retrieval
  const retrievalPromises = searchRequests.map(async (req) => {
    try {
      const docs = await vectorRetriever.invoke(req.query);
      return { type: req.type, docs };
    } catch (err) {
      console.warn(`Retrieval failed for type [${req.type}]:`, err.message);
      return { type: req.type, docs: [] };
    }
  });

  const retrievalResults = await Promise.all(retrievalPromises);

  // 7. Combine & Deduplicate via Reciprocal Rank Fusion (RRF)
  const fusedDocs = reciprocalRankFusion(
    retrievalResults,
    config.retrieval.rrfK || 60
  );

  // 8. Rerank retrieved candidate chunks using Cohere Cross-Encoder v3.5
  const topChunksToRerank = fusedDocs.slice(0, 15);
  const rerankedDocs = await rerankDocuments(
    query,
    topChunksToRerank,
    config.retrieval.finalTopK || 5
  );

  const finalChunks = rerankedDocs.length > 0 ? rerankedDocs : topChunksToRerank.slice(0, 5);

  // 9. Synthesize final answer with citations
  const parsedAnswer = await generateStructuredRAGResponse(query, finalChunks);

  // 10. Format Sources with structured timestamp objects & direct YouTube deep links
  const formattedSources = finalChunks.map((item) => {
    const startSecs = item.startSeconds || 0;
    const formattedTs = formatSecondsToTimestamp(startSecs);
    const videoId = item.videoId || "";
    const isYoutube = item.sourceType === "youtube";

    const timeUrl = isYoutube && videoId
      ? `https://youtu.be/${videoId}?t=${startSecs}s`
      : item.sourceUrl || "";

    return {
      text: item.pageContent,
      sourceType: item.sourceType || "document",
      sourceUrl: item.sourceUrl || item.document?.metadata?.sourceUrl || item.document?.metadata?.cloudinaryUrl || "",
      cloudinaryUrl: item.document?.metadata?.cloudinaryUrl || item.cloudinaryUrl || (item.sourceUrl?.startsWith('http') ? item.sourceUrl : null),
      title: item.title,
      pageNumber: item.pageNumber || item.document?.metadata?.pageNumber || null,
      videoId: item.videoId || null,
      timestamp: isYoutube ? {
        startSeconds: startSecs,
        formattedTimestamp: formattedTs,
        timeUrl: timeUrl,
      } : null,
      rrfScore: item.score,
      rerankScore: item.rerankScore,
    };
  });

  // Persist User Query and Assistant Response to MongoDB ChatMessage collection with userId scope
  try {
    await ChatMessage.create({
      workspaceId,
      userId,
      role: "user",
      query: query,
    });

    await ChatMessage.create({
      workspaceId,
      userId,
      role: "assistant",
      answer: parsedAnswer,
      sources: formattedSources,
    });
  } catch (err) {
    console.error("[Query Pipeline] Failed to persist ChatMessages to MongoDB:", err);
  }

  return {
    query,
    answer: parsedAnswer,
    translations,
    hyde: hydePassage,
    sources: formattedSources,
  };
}