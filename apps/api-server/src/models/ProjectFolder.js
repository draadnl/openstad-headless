const { plainTitle } = require('../util/plain-title');

module.exports = function (db, sequelize, DataTypes) {
  const ProjectFolder = sequelize.define(
    'project_folder',
    {
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        set: function (text) {
          this.setDataValue('name', plainTitle(text));
        },
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        default: null,
      },
    },
    {
      paranoid: true,
    }
  );

  ProjectFolder.associate = function (models) {
    this.hasMany(models.Project, { foreignKey: 'folderId' });
  };

  ProjectFolder.auth = ProjectFolder.prototype.auth = {
    listableBy: 'editor',
    viewableBy: 'editor',
    createableBy: 'admin',
    updateableBy: 'admin',
    deleteableBy: 'admin',
  };

  return ProjectFolder;
};
