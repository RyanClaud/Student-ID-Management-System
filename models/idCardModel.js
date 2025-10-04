import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";
import { Student } from "./studentModel.js";

export const IDCard = sequelize.define("IDCard", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: Student, key: "id" }
  },
  issue_date: { type: DataTypes.DATE, allowNull: false },
  expiry_date: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM("active", "lost", "expired"), defaultValue: "active" }
}, {
  tableName: "id_cards",
  timestamps: true
});

IDCard.belongsTo(Student, { foreignKey: "student_id" });
Student.hasMany(IDCard, { foreignKey: "student_id" });
