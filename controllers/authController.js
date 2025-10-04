
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import bcrypt from "bcrypt";
import { User, sequelize } from "../models/userModel.js";
await sequelize.sync();

export const loginPage = (req, res) => res.render("login", { title: "Login" });
export const registerPage = (req, res) => res.render("register", { title: "Register" });
export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password" });

import { Student } from "../models/studentModel.js";
import QRCode from "qrcode";
// User is already imported at the top

export const dashboardPage = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    // This page is only for students. Admins are redirected to /admin/dashboard.
    if (req.session.role === "student") {
      const student = await Student.findByPk(req.session.userId);
      if (!student) return res.send("Student record not found.");

      // The student object from the database already contains the qr_code.
      return res.render("student_dashboard", { title: "Student Dashboard", student });
    } else {
      // If not a student, they shouldn't be here. Redirect to login.
      return res.redirect("/login?error=Access Denied");
    }
  } catch (err) {
    res.render("dashboard", { title: "Dashboard", error: err.message });
  }
};


export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render("login", { error: "Email and password are required.", title: "Login" });
  }
  try {
    // Try student login first
    const student = await Student.findOne({ where: { email: email.trim().toLowerCase() } });
    if (student && await bcrypt.compare(password, student.password)) {
      req.session.userId = student.id;
      req.session.role = "student";
      return res.redirect("/dashboard");
    }
    // If not a student, try admin (User table)
    const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (user && await bcrypt.compare(password, user.password) && user.role === "admin") {
      req.session.userId = user.id;
      req.session.role = "admin";
      return res.redirect("/admin/dashboard");
    }
    return res.render("login", { error: "Invalid credentials.", title: "Login" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).render("login", { error: err.message || "Login failed.", title: "Login" });
  }
};


export const registerUser = async (req, res) => {
  // Debug: log the incoming form data and file
  console.log('Register received req.body:', req.body);
  console.log('Register received req.file:', req.file);

  let { first_name, last_name, email, password, course, year_level, role } = req.body;
  if (!first_name || !last_name || !email || !password || !course || !year_level) {
    return res.status(400).render("register", { error: "All fields are required.", title: "Register" });
  }
  first_name = first_name.trim();
  last_name = last_name.trim();
  email = email.trim().toLowerCase();
  course = course.trim();
  year_level = year_level.toString().trim();
  try {
    // Force year_level to integer
    let year_level_int = parseInt(year_level);
    if (isNaN(year_level_int)) {
      const yearMap = { "First Year": 1, "Second Year": 2, "Third Year": 3, "Fourth Year": 4 };
      year_level_int = yearMap[year_level] || null;
    }
    if (!year_level_int) {
      return res.status(400).render("register", { error: "Invalid year level.", title: "Register" });
    }
    // Check if student already exists
    const existing = await Student.findOne({ where: { email } });
    if (existing) {
      return res.status(400).render("register", { error: "A student with this email already exists.", title: "Register" });
    }
    const hashed = await bcrypt.hash(password, 10);
    let photo = null;
    if (req.file) {
      photo = `/uploads/${req.file.filename}`;
    }
    const student_number = "S-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    // Generate QR code with all student information
    const qrContent = `Student Details\n\nName: ${first_name} ${last_name}\nStudent Number: ${student_number}\nEmail: ${email}\nCourse: ${course}\nYear Level: ${year_level_int}`;
    const qr_code = await QRCode.toDataURL(qrContent);

    const student = await Student.create({
      student_number,
      first_name,
      last_name,
      course,
      year_level: year_level_int,
      email,
      photo,
      qr_code,
      password: hashed
    });

    req.session.userId = student.id;
    req.session.role = "student";
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).render("register", { error: err.message || "Registration failed.", title: "Register" });
  }
};

export const logoutUser = (req, res) => {
  req.session.destroy();
  res.redirect("/login");
};
