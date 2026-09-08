'use strict';

/**
 * Per-user "read" state for announcements.
 *
 * One nullable column rather than a join table. The unread count is simply the
 * announcements created after this timestamp, and opening the bell sets it to
 * now. NULL means the user has never opened it, so everything is unread.
 *
 * A join table would give exact per-announcement state at the cost of a row per
 * user per announcement - 200 users by 500 announcements is 100,000 rows to
 * power a badge - and buys nothing here, because the bell is a single list read
 * top down.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (table.lastSeenAnnouncementAt) return; // safe to re-run

    await queryInterface.addColumn('users', 'lastSeenAnnouncementAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (!table.lastSeenAnnouncementAt) return;
    await queryInterface.removeColumn('users', 'lastSeenAnnouncementAt');
  },
};
