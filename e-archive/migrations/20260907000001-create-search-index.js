'use strict';

/**
 * Search index tables.
 *
 * `file_index_state` is one row per file and doubles as the job queue, so a
 * file's indexing status and its place in the queue are the same fact and
 * cannot disagree. `file_text_chunks` holds one row per page of extracted
 * text, which is what lets a result cite the page a phrase was found on.
 *
 * The FULLTEXT index is raw SQL: Sequelize's queryInterface cannot create one.
 * It is added while the table is empty, which is far cheaper than building it
 * over an existing corpus.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.showAllTables();
    const has = (name) => existing.some((t) => String(t).toLowerCase() === name);

    if (!has('file_index_state')) {
      await queryInterface.createTable('file_index_state', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        fileId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          unique: true,
          references: { model: 'files', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        // pending -> running -> done | failed | skipped
        status: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: 'pending',
        },
        // Higher runs first. Fresh uploads use 100 so they jump the backfill.
        priority: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        // Which reader produced the text: pdf-text, plain-text, ocr, none
        engine: {
          type: Sequelize.STRING(16),
          allowNull: true,
        },
        pageCount: { type: Sequelize.INTEGER, allowNull: true },
        charCount: { type: Sequelize.INTEGER, allowNull: true },
        ocrConfidence: { type: Sequelize.FLOAT, allowNull: true },
        attempts: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        lastError: { type: Sequelize.TEXT, allowNull: true },
        nextAttemptAt: { type: Sequelize.DATE, allowNull: true },
        lockedBy: { type: Sequelize.STRING(64), allowNull: true },
        lockedAt: { type: Sequelize.DATE, allowNull: true },
        extractedAt: { type: Sequelize.DATE, allowNull: true },
        indexerVersion: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
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

      // The claim query orders by exactly this, so it can be answered from the
      // index alone rather than sorting the whole pending set.
      await queryInterface.addIndex('file_index_state', {
        name: 'idx_claim',
        fields: ['status', 'priority', 'nextAttemptAt', 'id'],
      });
      await queryInterface.addIndex('file_index_state', {
        name: 'idx_status',
        fields: ['status'],
      });
    }

    if (!has('file_text_chunks')) {
      await queryInterface.createTable('file_text_chunks', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        fileId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'files', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        // 1-based page number; 1 for single-page sources.
        page: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        content: { type: Sequelize.TEXT('medium'), allowNull: false },
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

      await queryInterface.addIndex('file_text_chunks', {
        name: 'uniq_file_page',
        unique: true,
        fields: ['fileId', 'page'],
      });

      // Default word parser, not ngram: the corpus is English, and ngram would
      // multiply the index size and flatten relevance ranking.
      await queryInterface.sequelize.query(
        'ALTER TABLE `file_text_chunks` ADD FULLTEXT KEY `ft_content` (`content`)'
      );
    }

    // Filter columns the search service uses. Added only if absent so this
    // migration is safe to re-run.
    const fileIndexes = await queryInterface.showIndex('files');
    const hasIndex = (name) => fileIndexes.some((i) => i.name === name);

    if (!hasIndex('idx_files_createdAt')) {
      await queryInterface.addIndex('files', { name: 'idx_files_createdAt', fields: ['createdAt'] });
    }
    if (!hasIndex('idx_files_department')) {
      await queryInterface.addIndex('files', { name: 'idx_files_department', fields: ['department'] });
    }
    if (!hasIndex('idx_files_ranchName')) {
      // Column name is misspelled in the original schema; kept as-is.
      await queryInterface.addIndex('files', { name: 'idx_files_ranchName', fields: ['ranchName'] });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('file_text_chunks');
    await queryInterface.dropTable('file_index_state');
    await queryInterface.removeIndex('files', 'idx_files_createdAt');
    await queryInterface.removeIndex('files', 'idx_files_department');
    await queryInterface.removeIndex('files', 'idx_files_ranchName');
  },
};
