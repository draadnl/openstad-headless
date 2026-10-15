import { afterEach, describe, expect, test } from 'vitest';

const required = require('./required');

function renderWith(clientOverrides = {}) {
  let rendered;
  const req = {
    client: {
      id: 1,
      clientId: 'abc',
      requiredUserFields: ['privacyConsent'],
      config: {
        requiredFields: {
          requiredUserFieldsLabels: {
            privacyConsent: 'Ik ga akkoord met de {link}',
          },
        },
      },
      ...clientOverrides,
    },
    user: {},
    query: {},
  };
  const res = {
    render: (view, locals) => {
      rendered = { view, locals };
    },
  };
  required.index(req, res, () => {});
  return rendered;
}

function consentField(rendered) {
  return rendered.locals.requiredFields.find((f) => f.key === 'privacyConsent');
}

describe('required-fields privacy consent label', () => {
  test('exposes a valid https policy URL plus prefix/text for the template', () => {
    const field = consentField(
      renderWith({ clientDisclaimerUrl: 'https://example.nl/privacy' })
    );
    expect(field.privacyUrl).toBe('https://example.nl/privacy');
    expect(field.labelPrefix).toBe('Ik ga akkoord met de ');
    expect(field.labelSuffix).toBe('');
    expect(field.privacyText).toBeTruthy();
  });

  test('drops javascript: policy URLs and leaves only plain text', () => {
    const field = consentField(
      renderWith({ clientDisclaimerUrl: 'javascript:alert(1)' })
    );
    expect(field.privacyUrl).toBe('');
    expect(field.privacyText).toBeTruthy();
  });

  test('quote injection in the policy URL is percent-encoded by new URL()', () => {
    const field = consentField(
      renderWith({
        clientDisclaimerUrl: 'https://example.nl/x?"onmouseover="alert(1)',
      })
    );
    expect(field.privacyUrl).not.toContain('"onmouseover="');
    expect(field.privacyUrl.startsWith('https://example.nl/')).toBe(true);
  });

  test('script tags in the disclaimer text are stripped', () => {
    const field = consentField(
      renderWith({
        clientDisclaimerUrl: 'https://example.nl/privacy',
        clientDisclaimerText: '<script>alert(1)</script>privacyverklaring',
      })
    );
    expect(field.privacyText).not.toContain('<script>');
  });
});

describe('required-fields @ in text fields (REQUIRED_FIELDS_BLOCK_AT_SIGN)', () => {
  const originalEnv = process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN;
    } else {
      process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN = originalEnv;
    }
  });

  function post(body, { requiredUserFields = ['name', 'email'], user } = {}) {
    const flashes = {};
    const result = { redirect: null, updated: null };
    const req = {
      client: {
        id: 1,
        clientId: 'abc',
        requiredUserFields,
        config: {
          requiredFields: { requiredUserFieldsLabels: { name: 'Schermnaam' } },
        },
      },
      redirectUri: 'https://example.nl/back',
      user: {
        ...user,
        update: (data) => {
          result.updated = data;
          return Promise.resolve();
        },
      },
      body,
      flash: (type, msg) => {
        (flashes[type] = flashes[type] || []).push(msg);
      },
    };
    const res = {
      redirect: (url) => {
        result.redirect = url;
      },
    };
    required.post(req, res, () => {});
    return { ...result, flashes };
  }

  test('saves a name with @ when the option is off', async () => {
    delete process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN;
    const result = post({ name: 'jan@example.nl', email: 'jan@example.nl' });
    await Promise.resolve();
    expect(result.updated).toEqual({
      name: 'jan@example.nl',
      email: 'jan@example.nl',
    });
  });

  test('refuses a name with @ and keeps the typed values', () => {
    process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN = 'true';
    const result = post({ name: 'jan@example.nl', email: 'jan@example.nl' });
    expect(result.updated).toBeNull();
    expect(result.redirect).toBe(
      `/auth/required-fields?redirect_uri=${encodeURIComponent('https://example.nl/back')}`
    );
    expect(result.flashes.error).toHaveLength(1);
    expect(result.flashes.error[0].msg).toContain("'Schermnaam'");
    expect(result.flashes.requiredFieldsValues[0]).toEqual({
      name: 'jan@example.nl',
      email: 'jan@example.nl',
    });
  });

  test('still allows @ in the e-mail field', async () => {
    process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN = 'true';
    const result = post({ name: 'Jan', email: 'jan@example.nl' });
    await Promise.resolve();
    expect(result.flashes.error).toBeUndefined();
    expect(result.updated).toEqual({ name: 'Jan', email: 'jan@example.nl' });
  });

  test('a missing privacy consent no longer saves the other fields', () => {
    const result = post(
      { name: 'Jan' },
      { requiredUserFields: ['name', 'privacyConsent'] }
    );
    expect(result.updated).toBeNull();
    expect(result.flashes.error[0].msg).toContain('privacyverklaring');
  });

  test('marks text fields in the form and refills previous values', () => {
    process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN = 'yes';
    let rendered;
    const req = {
      client: {
        id: 1,
        clientId: 'abc',
        requiredUserFields: ['name', 'email', 'privacyConsent'],
        config: {},
      },
      user: {},
      flash: (type) =>
        type === 'requiredFieldsValues' ? [{ name: 'jan@example.nl' }] : [],
    };
    required.index(
      req,
      { render: (view, locals) => (rendered = locals) },
      () => {}
    );
    const byKey = Object.fromEntries(
      rendered.requiredFields.map((f) => [f.key, f])
    );
    expect(byKey.name.blockAtSign).toBe(true);
    expect(byKey.name.value).toBe('jan@example.nl');
    expect(byKey.email.blockAtSign).toBe(false);
    expect(byKey.privacyConsent.blockAtSign).toBeUndefined();
  });
});
