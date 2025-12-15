    const sequelize = require("../dbConnect");
    const { Model, DataTypes } = require("sequelize");
    const User = require("./user")

    // This table is used for departments
    const ArchiveCategory = sequelize.define('admin-actions', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: DataTypes.INTEGER, allowNull: false, references: {model: User, Key: "id"} },
        description: { type: DataTypes.STRING },
        created_by: { type: DataTypes.STRING },
        message: {type: DataTypes.STRING}
    }, { timestamps: true });

    module.exports = ArchiveCategory;
