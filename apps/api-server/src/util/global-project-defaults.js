// Global defaults a new project inherits unless it sets its own value. Only non-empty
// values are copied, so an unset global still falls back to the project schema default.

const INHERITED_STYLING_KEYS = ['logo', 'favicon'];
const INHERITED_NOTIFICATION_KEYS = ['fromAddress', 'fromName', 'replyTo'];
const INHERITED_LOGIN_KEYS = ['fromAddress', 'fromName', 'helpAddress'];

// Pure half, split out so it can be tested without a database.
function buildProjectDefaults(siteConfig) {
  const defaults = { config: {}, emailConfig: {} };
  if (!siteConfig) return defaults;

  const globalConfig = siteConfig.config || {};
  const globalEmailConfig = siteConfig.emailConfig || {};

  INHERITED_STYLING_KEYS.forEach((key) => {
    if (globalConfig.styling?.[key]) {
      defaults.config.styling = defaults.config.styling || {};
      defaults.config.styling[key] = globalConfig.styling[key];
    }
  });

  INHERITED_NOTIFICATION_KEYS.forEach((key) => {
    if (globalEmailConfig.notifications?.[key]) {
      defaults.emailConfig.notifications =
        defaults.emailConfig.notifications || {};
      defaults.emailConfig.notifications[key] =
        globalEmailConfig.notifications[key];
    }
  });

  INHERITED_LOGIN_KEYS.forEach((key) => {
    if (globalEmailConfig.login?.[key]) {
      defaults.emailConfig.login = defaults.emailConfig.login || {};
      defaults.emailConfig.login[key] = globalEmailConfig.login[key];
    }
  });

  return defaults;
}

async function getGlobalProjectDefaults() {
  // Required lazily: a top level require opens a database connection at import time,
  // which makes this module unusable from a unit test.
  const db = require('../db');

  let siteConfig;
  try {
    siteConfig = await db.SiteConfig.findOne({ where: { id: 1 } });
  } catch (err) {
    console.log('Could not read global settings, skipping inheritance', err);
    return buildProjectDefaults(null);
  }

  return buildProjectDefaults(siteConfig);
}

module.exports = { getGlobalProjectDefaults, buildProjectDefaults };
