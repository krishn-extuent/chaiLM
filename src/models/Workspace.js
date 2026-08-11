import mongoose from "mongoose";

const SourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  sourceType: { 
    type: String, 
    enum: ["youtube", "pdf", "website"], 
    required: true 
  },
  sourceUrl: { type: String, required: true },
  cloudinaryUrl: { type: String, default: null },
  videoId: { type: String, default: null },
  indexedAt: { type: Date, default: Date.now },
});

const WorkspaceSchema = new mongoose.Schema(
  {
    workspaceId: { type: String, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, default: "Untitled Workspace" },
    sources: [SourceSchema],
  },
  { timestamps: true }
);

WorkspaceSchema.pre("save", function (next) {
  if (!this.workspaceId) {
    this.workspaceId = this._id.toString();
  }
  next();
});

export const Workspace = mongoose.model("Workspace", WorkspaceSchema);
