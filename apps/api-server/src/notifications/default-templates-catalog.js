const fs = require('fs').promises;
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, 'default-templates');

const SUBJECT_BODY_REGEX =
  /<subject>((?:.|\r|\n)*)<\/subject>(?:.|\r|\n)*<body>((?:.|\r|\n)*)<\/body>/;

// Dutch labels for the notification types exposed in the admin UI.
// Keep in sync with `notificationTypes` in
// apps/admin-server/src/components/notification-form.tsx.
const TYPE_LABELS = {
  'login email': 'Inloggen via e-mail',
  'login sms': 'Inloggen via sms',
  'new published resource - user feedback':
    'Nieuwe resource gepubliceerd - Notificatie naar de gebruiker',
  'new published resource - admin update':
    'Nieuwe resource gepubliceerd - Notificatie naar de admin',
  'updated resource - user feedback':
    'Resource bijgewerkt - Notificatie naar de gebruiker',
  'user account about to expire':
    'Gebruikersaccount staat op het punt te verlopen',
  'new enquete - admin':
    'Nieuwe formulier inzending - Notificatie naar de admin',
  'new enquete - user':
    'Nieuwe formulier inzending - Notificatie naar de gebruiker',
  'notification comment - user':
    'Nieuwe reactie op een inzending - Notificatie naar de gebruiker',
  'notification comment reply - user':
    'Nieuwe reactie op een reactie - Notificatie naar de gebruiker',
};

function resolveTemplatePath(type) {
  const resolved = path.resolve(TEMPLATES_DIR, String(type));
  if (path.dirname(resolved) !== path.resolve(TEMPLATES_DIR)) {
    throw new Error(`Invalid notification template type: ${type}`);
  }
  return resolved;
}

async function parseTemplateFile(type) {
  // `type` reaches this function from request bodies (see routes/notification),
  // so keep the lookup inside TEMPLATES_DIR.
  const file = (await fs.readFile(resolveTemplatePath(type))).toString();
  const match = file.match(SUBJECT_BODY_REGEX);
  const subject = match && match[1];
  const body = match && match[2];
  if (!subject || !body) return null;
  return { type, label: TYPE_LABELS[type] || type, subject, body };
}

async function getDefaultTemplate(type) {
  try {
    return await parseTemplateFile(type);
  } catch (err) {
    return null;
  }
}

async function getAllDefaultTemplates() {
  const types = await fs.readdir(TEMPLATES_DIR);
  const templates = await Promise.all(
    types.map((type) => parseTemplateFile(type).catch(() => null))
  );
  return templates.filter(Boolean);
}

module.exports = { getDefaultTemplate, getAllDefaultTemplates };
