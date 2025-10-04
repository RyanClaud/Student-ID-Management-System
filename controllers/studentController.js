import { Student } from "../models/studentModel.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";

// Auto-generate unique student number
function generateStudentNumber() {
  return "S-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

export const studentController = {
  async create(req, res) {
    try {
      const { first_name, last_name, course, year_level, email } = req.body;
      let photo = null;
      if (req.file) {
        photo = `/uploads/${req.file.filename}`;
      }
      const student_number = generateStudentNumber();
      // Generate QR code with all student information for consistency
      const qrContent = `Student Details\n\nName: ${first_name} ${last_name}\nStudent Number: ${student_number}\nEmail: ${email}\nCourse: ${course}\nYear Level: ${year_level}`;
      const qr_code = await QRCode.toDataURL(qrContent);
      const student = await Student.create({
        student_number, first_name, last_name, course, year_level, email, photo, qr_code,
      });
      res.status(201).json(student);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async list(req, res) {
    try {
      const students = await Student.findAll();
      res.json(students);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async get(req, res) {
    try {
      const student = await Student.findByPk(req.params.id);
      if (!student) return res.status(404).json({ error: "Not found" });
      res.json(student);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async update(req, res) {
    try {
      const student = await Student.findByPk(req.params.id);
      if (!student) return res.status(404).json({ error: "Not found" });
      const { first_name, last_name, course, year_level, email } = req.body;
      
      // Assign new values
      student.first_name = first_name;
      student.last_name = last_name;
      student.course = course;
      student.year_level = year_level;
      student.email = email;

      if (req.file) {
        student.photo = `/uploads/${req.file.filename}`;
      }

      // Regenerate the QR code with the updated information to ensure consistency
      const qrContent = `Student Details\n\nName: ${student.first_name} ${student.last_name}\nStudent Number: ${student.student_number}\nEmail: ${student.email}\nCourse: ${student.course}\nYear Level: ${student.year_level}`;
      student.qr_code = await QRCode.toDataURL(qrContent);

      await student.save();
      res.json(student);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async delete(req, res) {
    try {
      const student = await Student.findByPk(req.params.id);
      if (!student) return res.status(404).json({ error: "Not found" });
      await student.destroy();
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
