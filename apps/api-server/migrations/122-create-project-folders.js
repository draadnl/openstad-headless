const { Sequelize } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.createTable('project_folders', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addColumn('projects', 'folderId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'project_folders', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addIndex('projects', ['folderId'], {
      name: 'projects_folder_id',
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeIndex('projects', 'projects_folder_id');
    await queryInterface.removeColumn('projects', 'folderId');
    await queryInterface.dropTable('project_folders');
  },
};
