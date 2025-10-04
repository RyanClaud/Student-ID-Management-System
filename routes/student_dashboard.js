import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Student } from "../models/studentModel.js";
import PDFDocument from "pdfkit";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { create } from "hbs";
import QRCode from "qrcode";

const router = express.Router();

// Request replacement
router.post("/:id/request-replacement", requireAuth, requireRole("student"), async (req, res) => {
 
  res.send("Replacement request submitted!");
});

// Download student ID
router.get("/:id/download-id", requireAuth, requireRole("student"), async (req, res) => {
  const student = await Student.findByPk(req.params.id);
  if (!student) return res.status(404).send("Student not found");

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, right: 50, bottom: 50, left: 50 },
    layout: 'portrait'
  });

  // --- PDF Headers and Piping ---
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=student-id-${student.student_number}.pdf`);
  doc.pipe(res);

  // --- Reusable Drawing Functions ---
  const drawCard = (x, y, width, height, title) => {
    doc.roundedRect(x, y, width, height, 8).fillAndStroke('#FFFFFF', '#E5E7EB');
    doc.fillColor('#4A5568').fontSize(10).font('Helvetica-Bold').text(title, x, y + 15, { align: 'center' });
    doc.moveTo(x + 20, y + 35).lineTo(x + width - 20, y + 35).stroke('#E2E8F0');
  };

  // --- Document Header ---
  const logoPath = path.join("public", "images", "logo.png"); // Make sure you have a logo.png in public/images
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 45, { width: 50 });
  }
  doc.fillColor('#003366').fontSize(18).font('Helvetica-Bold').text('MINDORO STATE UNIVERSITY', 110, 50);
  doc.fillColor('#333333').fontSize(10).font('Helvetica').text('Official Student Digital ID Document', 112, 70);
  doc.moveTo(50, 100).lineTo(doc.page.width - 50, 100).stroke('#E2E8F0');

  // --- Card Dimensions and Positioning ---
  const cardWidth = 255; // 3.54 inches
  const cardHeight = 400; // 5.55 inches
  const cardX = (doc.page.width - cardWidth) / 2;
  const cardY = 140;

  // --- Draw ID Card Front ---
  drawCard(cardX, cardY, cardWidth, cardHeight, 'STUDENT ID - FRONT');

  // Blue header on the card
  doc.save();
  doc.path('M 178 140 H 422 a 8 8 0 0 1 8 8 V 240 H 170 V 148 a 8 8 0 0 1 8 -8 Z').fill('#003366');
  doc.restore();

  // Student Photo
  const photoSize = 100;
  const photoX = cardX + (cardWidth - photoSize) / 2;
  const photoY = cardY + 60;
  if (student.photo && fs.existsSync(path.join("public", student.photo))) {
    const photoPath = path.join("public", student.photo);
    doc.image(photoPath, photoX, photoY, { fit: [photoSize, photoSize], align: 'center', valign: 'center' })
       .circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 2)
       .lineWidth(3)
       .stroke('#FFFFFF');
  }

  // Student Name
  const nameY = photoY + photoSize + 15;
  doc.fillColor('#003366').fontSize(16).font('Helvetica-Bold').text(`${student.first_name} ${student.last_name}`, cardX, nameY, { align: 'center', width: cardWidth });

  // Course
  doc.fillColor('#6B7280').fontSize(10).font('Helvetica').text(student.course, cardX, nameY + 22, { align: 'center', width: cardWidth });

  // Student Number
  const idY = nameY + 50;
  doc.fillColor('#374151').fontSize(8).font('Helvetica').text('STUDENT NUMBER', cardX, idY, { align: 'center', width: cardWidth });
  doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text(student.student_number, cardX, idY + 12, { align: 'center', width: cardWidth });

  // --- Draw ID Card Back (simulated below the front) ---
  const backY = cardY + cardHeight + 30;
  drawCard(cardX, backY, cardWidth, cardHeight, 'STUDENT ID - BACK');

  // QR Code
  const qrY = backY + 50;
  if (student.qr_code) {
    const qrCodeDataUrl = student.qr_code;
    const qrBuffer = Buffer.from(qrCodeDataUrl.split(';base64,').pop(), 'base64');
    const qrSize = 120;
    const qrX = cardX + (cardWidth - qrSize) / 2;
    doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });
  }
  doc.fillColor('#6B7280').fontSize(8).text('Scan for verification', cardX, qrY + 130, { align: 'center', width: cardWidth });

  // "If found" text
  const infoText = 'This card is the property of Mindoro State University. If found, please return to the Office of the Registrar.';
  doc.fontSize(8).fillColor('#4A5568').text(infoText, cardX + 20, qrY + 180, {
    width: cardWidth - 40,
    align: 'center'
  });

  // Signature line
  const signatureY = qrY + 250;
  doc.moveTo(cardX + 40, signatureY + 15).lineTo(cardX + cardWidth - 40, signatureY + 15).stroke('#333333');
  doc.fillColor('#374151').fontSize(8).font('Helvetica-Oblique').text('Cardholder\'s Signature', cardX, signatureY + 20, { align: 'center', width: cardWidth });

  // --- Document Footer ---
  const footerY = doc.page.height - 70;
  doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).stroke('#E2E8F0');
  doc.fontSize(8).fillColor('#6B7280').text(`Document generated on: ${new Date().toLocaleDateString()}`, 50, footerY + 10, { align: 'left' });
  doc.fontSize(8).fillColor('#6B7280').text('Student ID Management System', doc.page.width - 50, footerY + 10, { align: 'right', width: 200 });

  doc.end();
});

// POST route to update student profile
router.post("/profile/edit", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const { first_name, last_name, email, password, confirm_password } = req.body;
    const student = await Student.findByPk(req.session.userId);

    if (!student) {
      return res.redirect("/dashboard?error=Student not found.");
    }

    // Update basic info
    student.first_name = first_name;
    student.last_name = last_name;
    student.email = email.trim().toLowerCase();

    // Handle password change
    if (password) {
      if (password !== confirm_password) {
        return res.redirect("/dashboard?error=Passwords do not match.");
      }
      student.password = await bcrypt.hash(password, 10);
    }

    await student.save();

    res.redirect("/dashboard?success=Profile updated successfully!");
  } catch (err) {
    console.error("Profile update error:", err);
    res.redirect("/dashboard?error=Failed to update profile.");
  }
});

export default router;
