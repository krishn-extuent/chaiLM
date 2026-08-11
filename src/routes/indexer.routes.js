import { Router } from "express";
import multer from "multer";
import { upload } from "../middlewares/multer.middlewares.js";
import { handleIndexDocument, handleGetWorkspaceSources } from "../controllers/indexer.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJwt);

const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post("/", handleUpload, handleIndexDocument);
router.get("/workspace/:workspaceId", handleGetWorkspaceSources);

export default router;