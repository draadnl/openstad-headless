const createError = require('http-errors');
const { Op } = require('sequelize');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const sanitize = require('../../util/sanitize');

const express = require('express');
const router = express.Router({ mergeParams: true });

function parseFolderBody(body) {
  const name = sanitize.title(String((body && body.name) || '').trim()).trim();
  if (!name) throw createError(400, 'Geen naam opgegeven');
  if (name.length > 255) throw createError(400, 'Naam is te lang');

  const rawIds = body.projectIds === undefined ? [] : body.projectIds;
  if (!Array.isArray(rawIds))
    throw createError(400, 'projectIds moet een lijst zijn');

  const projectIds = [];
  for (const id of rawIds) {
    const asNumber =
      typeof id === 'string' && id.trim() !== '' ? Number(id) : id;
    if (!Number.isInteger(asNumber) || asNumber < 1)
      throw createError(400, 'projectIds moet hele getallen bevatten');
    if (!projectIds.includes(asNumber)) projectIds.push(asNumber);
  }

  return { name, projectIds };
}

router
  .route('/')

  .get(auth.can('ProjectFolder', 'list'))
  .get(function (req, res, next) {
    db.ProjectFolder.findAll()
      .then((folders) => {
        const sorted = [...folders].sort((a, b) =>
          String(a.name).localeCompare(String(b.name))
        );
        res.json(sorted.map((folder) => folder.toJSON(req.user)));
      })
      .catch(next);
  })

  .post(auth.can('ProjectFolder', 'create'))
  .post(async function (req, res, next) {
    try {
      const { name, projectIds } = parseFolderBody(req.body);

      const folder = await db.sequelize.transaction(async (transaction) => {
        if (projectIds.length) {
          const found = await db.Project.count({
            where: { id: { [Op.in]: projectIds } },
            transaction,
          });
          if (found !== projectIds.length)
            throw createError(400, 'Onbekend project opgegeven');
        }

        const created = await db.ProjectFolder.create(
          { name },
          { transaction }
        );

        if (projectIds.length) {
          await db.Project.update(
            { folderId: created.id },
            { where: { id: { [Op.in]: projectIds } }, transaction }
          );
        }
        return created;
      });

      res.status(201).json(folder.toJSON(req.user));
    } catch (err) {
      next(err);
    }
  });

module.exports = router;
