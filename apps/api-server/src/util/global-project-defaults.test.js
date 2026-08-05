import { describe, expect, it } from 'vitest';

import { buildProjectDefaults } from './global-project-defaults.js';

describe('buildProjectDefaults', () => {
  it('returns empty defaults when there are no global settings', () => {
    expect(buildProjectDefaults(null)).toEqual({ config: {}, emailConfig: {} });
  });

  it('copies the configured branding', () => {
    const defaults = buildProjectDefaults({
      config: {
        styling: {
          logo: 'https://x.nl/logo.png',
          favicon: 'https://x.nl/f.ico',
        },
      },
    });
    expect(defaults.config.styling).toEqual({
      logo: 'https://x.nl/logo.png',
      favicon: 'https://x.nl/f.ico',
    });
  });

  it('skips empty values so the project schema default keeps winning', () => {
    const defaults = buildProjectDefaults({
      config: { styling: { logo: '', favicon: 'https://x.nl/f.ico' } },
      emailConfig: {
        notifications: { fromAddress: '', replyTo: 'reply@x.nl' },
      },
    });
    expect(defaults.config.styling).toEqual({ favicon: 'https://x.nl/f.ico' });
    expect(defaults.emailConfig.notifications).toEqual({
      replyTo: 'reply@x.nl',
    });
  });

  it('leaves a section out entirely when none of its keys are set', () => {
    const defaults = buildProjectDefaults({
      config: { styling: { logo: '', favicon: '' } },
      emailConfig: {
        login: { fromAddress: '', fromName: '', helpAddress: '' },
      },
    });
    expect(defaults).toEqual({ config: {}, emailConfig: {} });
  });

  it('copies the notification and login senders', () => {
    const defaults = buildProjectDefaults({
      emailConfig: {
        notifications: {
          fromAddress: 'notif@x.nl',
          fromName: 'Naam',
          replyTo: 'reply@x.nl',
        },
        login: {
          fromAddress: 'login@x.nl',
          fromName: 'Login Naam',
          helpAddress: 'help@x.nl',
        },
      },
    });
    expect(defaults.emailConfig).toEqual({
      notifications: {
        fromAddress: 'notif@x.nl',
        fromName: 'Naam',
        replyTo: 'reply@x.nl',
      },
      login: {
        fromAddress: 'login@x.nl',
        fromName: 'Login Naam',
        helpAddress: 'help@x.nl',
      },
    });
  });

  it('ignores keys outside the inherited set', () => {
    const defaults = buildProjectDefaults({
      config: {
        styling: { logo: 'https://x.nl/l.png', inlineCSS: 'body{}' },
        auth: {},
      },
      emailConfig: { notifications: { projectmanagerAddress: 'pm@x.nl' } },
    });
    expect(defaults.config).toEqual({
      styling: { logo: 'https://x.nl/l.png' },
    });
    expect(defaults.emailConfig).toEqual({});
  });

  it('tolerates a site config without config or emailConfig', () => {
    expect(buildProjectDefaults({})).toEqual({ config: {}, emailConfig: {} });
  });
});
