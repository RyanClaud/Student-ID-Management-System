import express from "express";
import { studentController } from "../controllers/studentController.js";
import multer from "multer";

const router = express.Router();

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// CRUD routes
router.post("/", upload.single("photo"), studentController.create);
router.get("/", studentController.list);
router.get("/:id", studentController.get);
router.put("/:id", upload.single("photo"), studentController.update);
router.delete("/:id", studentController.delete);

export default router;
