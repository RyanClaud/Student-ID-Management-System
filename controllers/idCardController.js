import { IDCard } from "../models/idCardModel.js";
import { Student } from "../models/studentModel.js";
import QRCode from "qrcode";

export const idCardController = {
  async create(req, res) {
    try {
      const { student_id, issue_date, expiry_date } = req.body;
      const status = "active";
      const idCard = await IDCard.create({ student_id, issue_date, expiry_date, status });
      // Optionally, update student's QR code or notify
      res.status(201).json(idCard);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async list(req, res) {
    try {
      const idCards = await IDCard.findAll({ include: Student });
      res.json(idCards);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async get(req, res) {
    try {
      const idCard = await IDCard.findByPk(req.params.id, { include: Student });
      if (!idCard) return res.status(404).json({ error: "Not found" });
      res.json(idCard);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async update(req, res) {
    try {
      const idCard = await IDCard.findByPk(req.params.id);
      if (!idCard) return res.status(404).json({ error: "Not found" });
      const { issue_date, expiry_date, status } = req.body;
      await idCard.update({ issue_date, expiry_date, status });
      res.json(idCard);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async delete(req, res) {
    try {
      const idCard = await IDCard.findByPk(req.params.id);
      if (!idCard) return res.status(404).json({ error: "Not found" });
      await idCard.destroy();
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
