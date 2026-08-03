const db = require('../db');
const { Op } = require('sequelize');
const hasRole = require('../lib/sequelize-authorization/lib/hasRole');
const {
  updateWidgetIds,
  TAG_ID_KEYS,
  STATUS_ID_KEYS,
  WIDGET_ID_KEYS,
} = require('./widget-config-remap');

// Whether the requesting user is allowed to use sourceProjectId as the
// source of a widget/project duplication (superuser, or admin/editor on
// the source project).
async function canUserUseSourceProjectForDuplication({ req, sourceProjectId }) {
  if (!sourceProjectId) return true;
  if (hasRole(req.user, 'superuser')) return true;

  const identifier = req.user?.idpUser?.identifier;
  const provider = req.user?.idpUser?.provider;
  if (!identifier || !provider) return false;

  const sourceProjectUser = await db.User.findOne({
    where: {
      projectId: sourceProjectId,
      idpUser: { identifier, provider },
      [Op.or]: [{ role: 'admin' }, { role: 'editor' }],
    },
  });

  return !!sourceProjectUser;
}

// Whether the requesting user may create content in targetProjectId.
//
// A role check alone is not enough here: `req.user.role` comes from a User row
// that, for fixed API tokens, is not scoped to the project in the URL. Copying
// widgets INTO a project is a write, so membership of the target project is
// verified explicitly, the same way the source project is.
async function canUserWriteToProject({ req, targetProjectId }) {
  if (hasRole(req.user, 'superuser')) return true;

  const identifier = req.user?.idpUser?.identifier;
  const provider = req.user?.idpUser?.provider;
  if (!identifier || !provider) return false;

  const targetProjectUser = await db.User.findOne({
    where: {
      projectId: targetProjectId,
      idpUser: { identifier, provider },
      [Op.or]: [{ role: 'admin' }, { role: 'editor' }],
    },
  });

  return !!targetProjectUser;
}

// Builds tagMap/statusMap for a widget-only copy between two DIFFERENT
// projects, matching source tags/statuses to the target project's
// tags/statuses by name. Unmatched source tags/statuses are simply absent
// from the returned maps (see clearUnmappedTagsAndStatuses above).
async function buildTargetMaps(sourceProjectId, targetProjectId) {
  const [sourceTags, targetTags, sourceStatuses, targetStatuses] =
    await Promise.all([
      db.Tag.findAll({ where: { projectId: sourceProjectId } }),
      db.Tag.findAll({ where: { projectId: targetProjectId } }),
      db.Status.findAll({ where: { projectId: sourceProjectId } }),
      db.Status.findAll({ where: { projectId: targetProjectId } }),
    ]);

  const targetTagIdByName = new Map(
    targetTags.map((tag) => [tag.name, tag.id])
  );
  const targetStatusIdByName = new Map(
    targetStatuses.map((status) => [status.name, status.id])
  );

  const tagMap = {};
  sourceTags.forEach((tag) => {
    const targetId = targetTagIdByName.get(tag.name);
    if (targetId) tagMap[tag.id] = targetId;
  });

  const statusMap = {};
  sourceStatuses.forEach((status) => {
    const targetId = targetStatusIdByName.get(status.name);
    if (targetId) statusMap[status.id] = targetId;
  });

  return { tagMap, statusMap };
}

module.exports = {
  canUserUseSourceProjectForDuplication,
  canUserWriteToProject,
  updateWidgetIds,
  buildTargetMaps,
  TAG_ID_KEYS,
  STATUS_ID_KEYS,
  WIDGET_ID_KEYS,
};
