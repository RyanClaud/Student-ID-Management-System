import express from "express";
import { idCardController } from "../controllers/idCardController.js"; // <-- correct import

const router = express.Router();

// CRUD routes
router.post("/", idCardController.create);
router.get("/", idCardController.list);
router.get("/:id", idCardController.get);
router.put("/:id", idCardController.update);
router.delete("/:id", idCardController.delete);

export default router;
