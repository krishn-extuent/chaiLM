import mongoose from "mongoose";

const CitationSchema = new mongoose.Schema({
  sourceType: { 
    type: String, 
    enum: ["youtube", "pdf", "website", "unknown"],
    default: "unknown"
  },
  pageNumber: { type: Number, default: null },
  startSeconds: { type: Number, default: null },
  formattedTimestamp: { type: String, default: null },
});

const AnswerSegmentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  citation: { type: CitationSchema, default: null },
});

const AnswerSchema = new mongoose.Schema({
  summary: { type: String, required: true },
  segments: [AnswerSegmentSchema],
});

const ChatMessageSchema = new mongoose.Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    query: { type: String, default: null }, // Filled if role === 'user'
    answer: { type: AnswerSchema, default: null }, // Filled if role === 'assistant'
    sources: { type: Array, default: [] }, // Retrieved grounding sources
  },
  { timestamps: true }
);

// Compound index for high-performance chronological queries
ChatMessageSchema.index({ workspaceId: 1, userId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
