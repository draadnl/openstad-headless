const { Op } = require('sequelize');
const db = require('../db');
const hasRole = require('../lib/sequelize-authorization/lib/hasRole');

async function findOwnProjectIds(user) {
  if (hasRole(user, 'superuser')) {
    return null;
  }

  const users = await db.User.findAll({
    where: {
      idpUser: {
        identifier: user?.idpUser?.identifier || 'no identifier found',
        provider: user?.idpUser?.provider || 'no provider found',
      },
      [Op.or]: [{ role: 'admin' }, { role: 'editor' }],
    },
  });

  return users.map((u) => u.projectId);
}

module.exports = { findOwnProjectIds };
