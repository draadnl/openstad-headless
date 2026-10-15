import { afterEach, describe, expect, test } from 'vitest';

const path = require('path');
const nunjucks = require('nunjucks');
const required = require('./required');

// Same settings as app-init.js, so the test renders the form the resident sees
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(path.join(__dirname, '../../views')),
  { autoescape: true }
);

function renderForm({ requiredUserFields, previousValues } = {}) {
  let html;
  const req = {
    client: {
      id: 1,
      clientId: 'abc',
      requiredUserFields: requiredUserFields || ['name', 'email', 'city'],
      config: {},
    },
    user: {},
    flash: (type) =>
      type === 'requiredFieldsValues' && previousValues ? [previousValues] : [],
  };
  const res = {
    render: (view, locals) => {
      html = env.render(`${view}.html`, { ...locals, messages: {} });
    },
  };
  required.index(req, res, () => {});
  return html;
}

function inputTag(html, key) {
  const match = html.match(
    new RegExp(`<input[^>]*id="input_field_${key}"[^>]*>`)
  );
  if (!match) throw new Error(`No input rendered for ${key}`);
  return match[0];
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : null;
}

// Browsers match the pattern attribute against the whole value, with the v flag
function browserAccepts(tag, value) {
  const pattern = attr(tag, 'pattern');
  if (pattern === null) return true;
  return new RegExp(`^(?:${pattern})$`, 'v').test(value);
}

describe('required-fields form with REQUIRED_FIELDS_BLOCK_AT_SIGN', () => {
  const originalEnv = process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN;
    } else {
      process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN = originalEnv;
    }
  });

  test('the name field refuses an e-mail address in the browser', () => {
    process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN = 'true';
    const name = inputTag(renderForm(), 'name');

    expect(browserAccepts(name, 'jan@example.nl')).toBe(false);
    expect(browserAccepts(name, 'Jan de Vries')).toBe(true);
    expect(attr(name, 'title')).toContain('@');
  });

  test('other text fields refuse an @ too, the e-mail field does not', () => {
    process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN = 'true';
    const html = renderForm();

    expect(browserAccepts(inputTag(html, 'city'), 'a@b')).toBe(false);
    expect(attr(inputTag(html, 'email'), 'pattern')).toBeNull();
  });

  test('without the option the form accepts an @ everywhere', () => {
    delete process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN;
    const html = renderForm();

    expect(html).not.toContain('pattern=');
    expect(browserAccepts(inputTag(html, 'name'), 'jan@example.nl')).toBe(true);
  });

  test('values kept after a refused submit are filled in and escaped', () => {
    process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN = 'true';
    const html = renderForm({
      previousValues: { name: 'jan@example.nl', city: '"><script>x</script>' },
    });

    expect(attr(inputTag(html, 'name'), 'value')).toBe('jan@example.nl');
    expect(html).not.toContain('<script>x</script>');
    expect(attr(inputTag(html, 'city'), 'value')).toBe(
      '&quot;&gt;&lt;script&gt;x&lt;/script&gt;'
    );
  });
});
