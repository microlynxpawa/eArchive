'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('file_sending_history', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      senderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      senderUsername: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      receiverUsername: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      receiverId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      fileNames: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      batchName: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      fileCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes for performance
    // Note: senderId and receiverId already have indexes from foreign key constraints
    await queryInterface.addIndex('file_sending_history', ['sentAt']);
    await queryInterface.addIndex('file_sending_history', ['senderUsername']);
    await queryInterface.addIndex('file_sending_history', ['receiverUsername']);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('file_sending_history');
  },
};
