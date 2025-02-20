    const sequelize = require("../dbConnect");
    const { Model, DataTypes } = require("sequelize");

    // This table is used for departments
    const ArchiveCategory = sequelize.define('archive_category', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING },
        description: { type: DataTypes.STRING },
        created_by: { type: DataTypes.STRING }
    }, { timestamps: true });

    module.exports = ArchiveCategory;
