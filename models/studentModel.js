import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Student = sequelize.define("Student", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  student_number: { type: DataTypes.STRING, unique: true, allowNull: false },
  first_name: { type: DataTypes.STRING, allowNull: false },
  last_name: { type: DataTypes.STRING, allowNull: false },
  course: { type: DataTypes.STRING, allowNull: false },
  year_level: { type: DataTypes.INTEGER, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  photo: { type: DataTypes.STRING }, // path or URL
  qr_code: { type: DataTypes.TEXT }, // path or data URL
}, {
  tableName: "students",
  timestamps: true
});
