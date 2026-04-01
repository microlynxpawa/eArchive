const { DataTypes } = require('sequelize');
const sequelize = require('../dbConnect');
const User = require('./user');

/**
 * FileSendingHistory Model
 * Tracks all file sending operations with sender, receiver, files, and timestamps
 */
const FileSendingHistory = sequelize.define(
  'FileSendingHistory',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'User ID of the person who sent the files',
    },
    senderUsername: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Username of the sender (denormalized for queries)',
    },
    receiverUsername: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Username of the receiver',
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
      onDelete: 'SET NULL',
      comment: 'User ID of the receiver (if available)',
    },
    fileNames: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of file names sent (includes batch name if applicable)',
    },
    filePath: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of file paths for accessing files later',
    },
    batchName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Batch name if files were sent as part of a batch',
    },
    fileCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Total count of files sent in this operation',
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp when files were sent',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'file_sending_history',
    timestamps: true,
    indexes: [
      { fields: ['senderId'] },
      { fields: ['senderUsername'] },
      { fields: ['receiverUsername'] },
      { fields: ['receiverId'] },
      { fields: ['sentAt'] },
      { fields: ['senderId', 'sentAt'] }, // For quick user history queries
    ],
  }
);

module.exports = FileSendingHistory;
