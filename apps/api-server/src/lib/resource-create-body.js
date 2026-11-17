const hasRole = require('./sequelize-authorization/lib/hasRole');

// Fields anyone who may submit a resource is allowed to send on create.
// Everything else in the request body is dropped before it reaches the
// model, so a column added later is closed by default until it is listed
// here. Field-level auth in the model (createableBy) still applies on top.
const PUBLIC_CREATE_FIELDS = [
  'title',
  'summary',
  'description',
  'budget',
  'images',
  'documents',
  'location',
  'extraData',
  'timeline',
  // guarded by createableBy: 'editor' in the model, but the resource form
  // widget may send it as a regular field
  'modBreaks',
  // the resource form widget sets this itself on a normal submission
  'publishDate',
  // handled by separate middleware further down the create route
  'tags',
  'statuses',
  'links',
  'removedLinks',
  'confirmationUser',
  'confirmationAdmin',
  'widgetId',
];

// Additional fields editors (and higher) may set when creating a resource,
// e.g. from the admin panel.
const EDITOR_CREATE_FIELDS = ['startDate', 'sort', 'score', 'viewableByRole'];

function getAllowedCreateFields(user) {
  return hasRole(user, 'editor')
    ? [...PUBLIC_CREATE_FIELDS, ...EDITOR_CREATE_FIELDS]
    : PUBLIC_CREATE_FIELDS;
}

function filterResourceCreateBody(body, user) {
  const allowed = getAllowedCreateFields(user);
  const result = {};
  if (!body || typeof body !== 'object') return result;

  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      result[key] = body[key];
    }
  });

  return result;
}

module.exports = {
  PUBLIC_CREATE_FIELDS,
  EDITOR_CREATE_FIELDS,
  getAllowedCreateFields,
  filterResourceCreateBody,
};
