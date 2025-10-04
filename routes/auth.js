import express from "express";
import { loginPage, registerPage, forgotPasswordPage, dashboardPage, loginUser, registerUser, logoutUser } from "../controllers/authController.js";
import multer from "multer";

const router = express.Router();

// File upload config for registration
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, "public/uploads/"),
	filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", upload.single("photo"), registerUser);
router.get("/forgotpassword", forgotPasswordPage);
router.get("/dashboard", dashboardPage);
router.get("/logout", logoutUser);

export default router;
