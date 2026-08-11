import { Workspace } from "../models/Workspace.js";
import { ChatMessage } from "../models/ChatMessage.js";

/**
 * Controller to create a new workspace
 * Endpoint: POST /api/workspace
 * Request body: { title: string }
 */
export async function handleCreateWorkspace(req, res) {
  try {
    const { title } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "Title is required to create a workspace" });
    }

    const newWorkspace = new Workspace({
      userId,
      title: title.trim(),
      sources: [],
    });

    await newWorkspace.save();

    return res.status(201).json({
      message: "Workspace created successfully",
      data: {
        workspaceId: newWorkspace.workspaceId || newWorkspace._id.toString(),
        title: newWorkspace.title,
        sources: newWorkspace.sources,
        createdAt: newWorkspace.createdAt,
        updatedAt: newWorkspace.updatedAt,
      },
    });
  } catch (error) {
    console.error("Create Workspace Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to create workspace",
    });
  }
}

/**
 * Controller to fetch workspace details and chat history
 * Endpoint: GET /api/workspace/:workspaceId
 */
export async function handleGetWorkspaceData(req, res) {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace ID is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const [workspaceDoc, chatHistory] = await Promise.all([
      Workspace.findOne({ workspaceId, userId }),
      ChatMessage.find({ workspaceId, userId }).sort({ createdAt: 1 }),
    ]);

    if (!workspaceDoc) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    return res.status(200).json({
      message: "Workspace hydrated successfully",
      data: {
        workspaceId: workspaceDoc.workspaceId || workspaceDoc._id.toString(),
        title: workspaceDoc.title,
        sources: workspaceDoc.sources || [],
        history: chatHistory.map((msg) => ({
          id: msg._id,
          role: msg.role,
          query: msg.query,
          answer: msg.answer,
          sources: msg.sources,
          createdAt: msg.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Get Workspace Data Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to retrieve workspace data",
    });
  }
}

/**
 * Controller to fetch all user workspaces
 * Endpoint: GET /api/workspace
 */
export async function handleGetAllWorkspaces(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const workspaces = await Workspace.find({ userId })
      .select("workspaceId title sources.title sources.sourceType createdAt updatedAt")
      .sort({ updatedAt: -1 });

    const formattedWorkspaces = workspaces.map((ws) => ({
      workspaceId: ws.workspaceId || ws._id.toString(),
      title: ws.title,
      sourceCount: ws.sources ? ws.sources.length : 0,
      sourcesSummary: ws.sources || [],
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
    }));

    return res.status(200).json({
      message: "Workspaces retrieved successfully",
      data: formattedWorkspaces,
    });
  } catch (error) {
    console.error("Get All Workspaces Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to retrieve workspaces",
    });
  }
}

/**
 * Controller to delete a workspace
 * Endpoint: DELETE /api/workspace/:workspaceId
 */
export async function handleDeleteWorkspace(req, res) {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace ID is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const workspaceDoc = await Workspace.findOne({ workspaceId, userId });
    if (!workspaceDoc) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    await Promise.all([
      Workspace.deleteOne({ workspaceId, userId }),
      ChatMessage.deleteMany({ workspaceId, userId }),
    ]);

    return res.status(200).json({
      message: "Workspace deleted successfully",
      data: { workspaceId },
    });
  } catch (error) {
    console.error("Delete Workspace Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to delete workspace",
    });
  }
}
