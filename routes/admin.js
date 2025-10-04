import { Parser as Json2csvParser } from "json2csv";
import PDFDocument from "pdfkit";
import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Student } from "../models/studentModel.js";
import multer from "multer";
import bcrypt from "bcrypt"; 
import QRCode from "qrcode";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";

const router = express.Router();

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Admin dashboard with search/filter
router.get("/dashboard", requireAuth, requireRole("admin"), async (req, res) => {
  const { search = "", course = "", year_level = "" } = req.query;
  const where = {};
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.like]: `%${search}%` } },
      { last_name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { student_number: { [Op.like]: `%${search}%` } }
    ];
  }
  if (course) where.course = course;
  if (year_level) where.year_level = year_level;
  const students = await Student.findAll({ where });
  // For filter dropdowns
  const courses = await Student.aggregate('course', 'DISTINCT', { plain: false }).then(rows => rows.map(r => r.DISTINCT));
  const years = await Student.aggregate('year_level', 'DISTINCT', { plain: false }).then(rows => rows.map(r => r.DISTINCT).sort((a, b) => a - b));

  // --- Dashboard Statistics ---
  const totalStudents = await Student.count();
  const mostPopularCourse = await Student.findOne({
    attributes: ['course', [Student.sequelize.fn('COUNT', Student.sequelize.col('course')), 'count']],
    group: ['course'],
    order: [[Student.sequelize.fn('COUNT', Student.sequelize.col('course')), 'DESC']],
    limit: 1,
    raw: true,
  });

  res.render("admin_dashboard", {
    title: "Admin Dashboard",
    students,
    courses,
    years,
    search,
    stats: {
      totalStudents: totalStudents,
      distinctCourses: courses.length,
      mostPopularCourse: mostPopularCourse ? mostPopularCourse.course : 'N/A',
    },
    selectedCourse: course,
    selectedYear: year_level
  });
});


// GET route to show the "Add Student" form
router.get("/students/add", requireAuth, requireRole("admin"), (req, res) => {
  res.render("add_student", { title: "Add New Student" });
});

// POST route to create a new student
router.post("/students/add", requireAuth, requireRole("admin"), upload.single("photo"), async (req, res) => {
  try {
    const { first_name, last_name, email, password, course, year_level } = req.body;
    if (!first_name || !last_name || !email || !password || !course || !year_level) {
      return res.status(400).render("add_student", { error: "All fields are required.", title: "Add New Student" });
    }

    const existing = await Student.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return res.status(400).render("add_student", { error: "A student with this email already exists.", title: "Add New Student" });
    }

    const student_number = "S-" + Date.now();
    // Generate QR code with all student information for consistency
    const qrContent = `Student Details\n\nName: ${first_name} ${last_name}\nStudent Number: ${student_number}\nEmail: ${email.trim().toLowerCase()}\nCourse: ${course}\nYear Level: ${parseInt(year_level)}`;
    const qr_code = await QRCode.toDataURL(qrContent);
    const hashedPassword = await bcrypt.hash(password, 10);

    await Student.create({
      student_number,
      first_name,
      last_name,
      course,
      year_level: parseInt(year_level),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      qr_code,
      photo: req.file ? `/uploads/${req.file.filename}` : null,
    });

    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Admin Add Student Error:", err);
    res.status(500).render("add_student", { error: "Failed to create student.", title: "Add New Student" });
  }
});

// GET route to show the "Edit Student" form
router.get("/students/:id/edit", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).send("Student not found");
    res.render("edit_student", { title: "Edit Student", student: student.dataValues });
  } catch (err) {
    res.redirect("/admin/dashboard");
  }
});

// GET route to return student data as JSON (for modals)
router.get("/students/:id/json", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST route to update a student
router.post("/students/:id/edit", requireAuth, requireRole("admin"), upload.single("photo"), async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).send("Student not found");

    const { first_name, last_name, email, course, year_level } = req.body;
    student.first_name = first_name;
    student.last_name = last_name;
    student.email = email;
    student.course = course;
    student.year_level = parseInt(year_level);

    if (req.file) {
      student.photo = `/uploads/${req.file.filename}`;
    }

    // Regenerate the QR code with the updated information
    const qrContent = `Student Details\n\nName: ${student.first_name} ${student.last_name}\nStudent Number: ${student.student_number}\nEmail: ${student.email}\nCourse: ${student.course}\nYear Level: ${student.year_level}`;
    student.qr_code = await QRCode.toDataURL(qrContent);

    await student.save();
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Admin Edit Student Error:", err);
    res.redirect(`/admin/students/${req.params.id}/edit`);
  }
});

// POST route to delete a student
router.post("/students/:id/delete", requireAuth, requireRole("admin"), async (req, res) => {
  await Student.destroy({ where: { id: req.params.id } });
  res.redirect("/admin/dashboard");
});

// Export students to CSV
router.get("/export/csv", requireAuth, requireRole("admin"), async (req, res) => {
  const students = await Student.findAll();
  const fields = ["student_number", "first_name", "last_name", "course", "year_level", "email"];
  const parser = new Json2csvParser({ fields });
  const csv = parser.parse(students.map(s => s.dataValues));
  res.header("Content-Type", "text/csv");
  res.attachment("students.csv");
  res.send(csv);
});

// Export students to PDF
router.get("/export/pdf", requireAuth, requireRole("admin"), async (req, res) => {
  const { search = "", course = "", year_level = "" } = req.query;
  const where = {};
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.like]: `%${search}%` } },
      { last_name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { student_number: { [Op.like]: `%${search}%` } }
    ];
  }
  if (course) where.course = course;
  if (year_level) where.year_level = year_level;

  const students = await Student.findAll({ where });
  const doc = new PDFDocument({ margin: 50, layout: 'landscape' });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=students.pdf");
  doc.pipe(res);

  // --- Reusable Header and Footer ---
  const drawHeader = () => {
    const logoPath = path.join("public", "images", "logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 40 });
    }
    doc.fillColor('#003366').fontSize(16).font('Helvetica-Bold').text('MINDORO STATE UNIVERSITY', 100, 45);
    doc.fillColor('#333333').fontSize(10).font('Helvetica').text('Student Records Export', 102, 65);
    doc.moveTo(50, 90).lineTo(doc.page.width - 50, 90).stroke('#E2E8F0');
  };

  const drawFooter = (page) => {
    const range = doc.page.height - 50;
    doc.fontSize(8).fillColor('#6B7280').text(`Page ${page}`, 50, range, { align: 'left' });
    doc.fontSize(8).fillColor('#6B7280').text(`Generated: ${new Date().toLocaleString()}`, doc.page.width - 50, range, { align: 'right' });
  };

  // --- Table Drawing Logic ---
  const tableTop = 120;
  const columnWidths = { student_number: 140, name: 150, email: 180, course: 120, year_level: 50 };
  const columnPositions = {
    student_number: 50,
    name: 190,
    email: 340,
    course: 520,
    year_level: 640
  };

  const drawTableRow = (y, student) => {
    doc.fontSize(9).fillColor('#333');
    doc.font('Helvetica').text(student.student_number, columnPositions.student_number, y, { width: columnWidths.student_number, lineBreak: false });
    doc.text(`${student.first_name} ${student.last_name}`, columnPositions.name, y, { width: columnWidths.name });
    doc.text(student.email, columnPositions.email, y, { width: columnWidths.email });
    doc.text(student.course, columnPositions.course, y, { width: columnWidths.course });
    doc.text(student.year_level, columnPositions.year_level, y, { width: columnWidths.year_level, align: 'center' });
  };

  // --- Generate Document ---
  let pageNumber = 1;
  drawHeader();
  drawFooter(pageNumber);

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Student Number', columnPositions.student_number, tableTop);
  doc.text('Name', columnPositions.name, tableTop);
  doc.text('Email', columnPositions.email, tableTop);
  doc.text('Course', columnPositions.course, tableTop);
  doc.text('Year', columnPositions.year_level, tableTop, { align: 'center' });
  doc.moveTo(50, tableTop + 20).lineTo(doc.page.width - 50, tableTop + 20).stroke('#E2E8F0');

  let y = tableTop + 30;
  for (const student of students) {
    if (y > doc.page.height - 80) { // Check if new page is needed
      doc.addPage();
      pageNumber++;
      drawHeader();
      drawFooter(pageNumber);
      y = 100;
    }
    drawTableRow(y, student);
    y += 40; // Row height
  }

  doc.end();
});

export default router;
