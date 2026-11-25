const createError = require('http-errors');
const { Op } = require('sequelize');
const db = require('../../db');
const auth = require('../../middleware/sequelize-authorization-middleware');
const sanitize = require('../../util/sanitize');

const express = require('express');
const router = express.Router({ mergeParams: true });

function parseFolderBody(body, { projectIdsOptional = false } = {}) {
  const name = sanitize.title(String((body && body.name) || '').trim()).trim();
  if (!name) throw createError(400, 'Geen naam opgegeven');
  if (name.length > 255) throw createError(400, 'Naam is te lang');

  if (projectIdsOptional && body.projectIds === undefined)
    return { name, projectIds: undefined };

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

async function loadFolder(req) {
  const folder = await db.ProjectFolder.findByPk(Number(req.params.id));
  if (!folder) throw createError(404, 'Map niet gevonden');
  return folder;
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

router
  .route('/:id(\\d+)')

  .put(auth.can('ProjectFolder', 'update'))
  .put(async function (req, res, next) {
    try {
      const folder = await loadFolder(req);
      const { name, projectIds } = parseFolderBody(req.body, {
        projectIdsOptional: true,
      });

      await db.sequelize.transaction(async (transaction) => {
        if (projectIds && projectIds.length) {
          const found = await db.Project.count({
            where: { id: { [Op.in]: projectIds } },
            transaction,
          });
          if (found !== projectIds.length)
            throw createError(400, 'Onbekend project opgegeven');
        }

        await folder.update({ name }, { transaction });

        if (projectIds) {
          await db.Project.update(
            { folderId: null },
            {
              where: {
                folderId: folder.id,
                ...(projectIds.length
                  ? { id: { [Op.notIn]: projectIds } }
                  : {}),
              },
              paranoid: false,
              transaction,
            }
          );

          if (projectIds.length) {
            await db.Project.update(
              { folderId: folder.id },
              { where: { id: { [Op.in]: projectIds } }, transaction }
            );
          }
        }
      });

      res.json(folder.toJSON(req.user));
    } catch (err) {
      next(err);
    }
  })

  .delete(auth.can('ProjectFolder', 'delete'))
  .delete(async function (req, res, next) {
    try {
      const folder = await loadFolder(req);

      await db.sequelize.transaction(async (transaction) => {
        await db.Project.update(
          { folderId: null },
          { where: { folderId: folder.id }, paranoid: false, transaction }
        );
        await folder.destroy({ transaction });
      });

      res.json({ projectFolder: 'deleted' });
    } catch (err) {
      next(err);
    }
  });

module.exports = router;
