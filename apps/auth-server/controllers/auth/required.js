const userFields = require('../../config/user').fields;
const sanitize = require('../../utils/sanitize');

// Opt-in: residents regularly fill in their e-mail address as their name,
// which then shows publicly next to their comments. With
// REQUIRED_FIELDS_BLOCK_AT_SIGN the text fields (except e-mail and access
// code) refuse an '@'.
const isAtSignBlocked = () =>
  ['true', 'yes', '1'].includes(
    String(process.env.REQUIRED_FIELDS_BLOCK_AT_SIGN || '')
      .trim()
      .toLowerCase()
  );

const blocksAtSign = (field) =>
  isAtSignBlocked() &&
  !!field &&
  field.type !== 'checkbox' &&
  !field.allowAtSign;

const getFieldLabel = (req, field) => {
  const labels =
    req.client?.config?.requiredFields?.requiredUserFieldsLabels || {};
  return sanitize.noTags(labels[field.key] || field.label);
};

const consumeFlash = (req, key) =>
  (typeof req.flash === 'function' && req.flash(key)?.[0]) || {};

exports.index = (req, res, next) => {
  let requiredUserFields = req.client.requiredUserFields;
  const previousValues = consumeFlash(req, 'requiredFieldsValues');

  requiredUserFields = requiredUserFields
    .map((field) => {
      const found = userFields.find((userField) => userField.key === field);
      return found ? { ...found } : null;
    })
    .filter(Boolean);

  requiredUserFields = requiredUserFields.filter((field) => {
    if (!field) return false;

    // Consent field is a special case since it can contain multiple client IDs
    if (field?.key === 'emailNotificationConsent') {
      const clientId = String(req?.client?.id);

      const currentValue = req?.user?.emailNotificationConsent || {};
      const clientConsentIsSet = currentValue.hasOwnProperty(clientId);

      return !clientConsentIsSet;
    }

    // Privacy consent is stored per client ID as a timestamp
    if (field?.key === 'privacyConsent') {
      const clientId = String(req?.client?.id);
      const currentValue = req?.user?.privacyConsentAt || {};
      const clientConsentIsSet = currentValue.hasOwnProperty(clientId);

      return !clientConsentIsSet;
    }

    return !req.user[field.key];
  });

  const config = req.client.config ? req.client.config : {};
  const configRequiredFields =
    config && config.requiredFields ? config.requiredFields : {};

  const requiredUserFieldsLabels =
    (config && config.requiredFields?.requiredUserFieldsLabels) || {};

  // Only absolute http(s) URLs; new URL(...).href percent-encodes quotes so
  // the value is safe inside the href attribute
  let privacyPolicyUrl = '';
  try {
    const parsed = new URL(
      req.client.clientDisclaimerUrl || config?.clientDisclaimerUrl || ''
    );
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      privacyPolicyUrl = parsed.href;
    }
  } catch {
    privacyPolicyUrl = '';
  }
  const privacyPolicyTextRaw = sanitize.noTags(
    req.client.clientDisclaimerText ||
      config?.clientDisclaimerText ||
      'privacyverklaring'
  );
  const privacyPolicyText =
    privacyPolicyTextRaw.charAt(0).toLowerCase() +
    privacyPolicyTextRaw.slice(1);

  // Replace field labels with labels defined in the client config (if provided)
  if (Object.keys(requiredUserFieldsLabels).length > 0) {
    requiredUserFields = requiredUserFields.map((field) => {
      const newLabel = requiredUserFieldsLabels[field.key];

      if (!!newLabel) {
        field.label = sanitize.noTags(newLabel);
      }

      return field;
    });
  }

  // Split the {link} placeholder in the privacyConsent label into structured
  // parts so the template can build the anchor under autoescape. No server-side
  // HTML composition, so the view needs no |safe on the label.
  requiredUserFields = requiredUserFields.map((field) => {
    if (field.key === 'privacyConsent' && field.label.includes('{link}')) {
      const [labelPrefix, labelSuffix] = sanitize
        .noTags(field.label)
        .split('{link}');
      field.labelPrefix = labelPrefix;
      field.labelSuffix = labelSuffix || '';
      field.privacyUrl = privacyPolicyUrl;
      field.privacyText = privacyPolicyText;
    }
    return field;
  });

  requiredUserFields = requiredUserFields.map((field) => {
    if (field.type === 'checkbox') return field;
    field.blockAtSign = blocksAtSign(field);
    if (typeof previousValues[field.key] === 'string') {
      field.value = previousValues[field.key];
    }
    return field;
  });

  res.render('auth/required-fields', {
    client: sanitize.client(req.client),
    clientId: sanitize.plainText(req.client.clientId),
    requiredFields: requiredUserFields,
    info: sanitize.safeTags(configRequiredFields.info),
    description: sanitize.safeTags(configRequiredFields.description),
    title: sanitize.safeTags(configRequiredFields.title),
    buttonText: sanitize.safeTags(configRequiredFields.buttonText),
    redirect_uri: req.redirectUri ? encodeURIComponent(req.redirectUri) : '',
  });
};

exports.post = (req, res, next) => {
  const clientRequiredUserFields = req.client.requiredUserFields;
  const redirectUrl = req.redirectUri
    ? encodeURIComponent(req.redirectUri)
    : req.client.redirectUrl;
  if (!redirectUrl)
    return next(
      new Error(
        'No redirect_uri provided and no default redirectUrl configured for this client'
      )
    );

  // Validate before saving: a redirect from inside the forEach below would
  // not stop the update
  const errors = [];
  clientRequiredUserFields.forEach((key) => {
    const field = userFields.find((userField) => userField.key === key);
    if (!field) return;

    if (key === 'privacyConsent') {
      const clientId = String(req?.client?.id);
      const currentValue = req?.user?.privacyConsentAt || {};
      if (!currentValue.hasOwnProperty(clientId) && req.body[key] !== 'on') {
        errors.push(
          'Je moet akkoord gaan met de privacyverklaring om verder te gaan.'
        );
      }
    } else if (
      blocksAtSign(field) &&
      typeof req.body[key] === 'string' &&
      req.body[key].includes('@')
    ) {
      errors.push(
        `Het veld '${getFieldLabel(req, field)}' mag geen @ bevatten. Vul hier niet je e-mailadres in.`
      );
    }
  });

  if (errors.length > 0) {
    errors.forEach((msg) => req.flash('error', { msg }));

    // Keep the typed text values so the resident doesn't have to retype them
    const values = {};
    clientRequiredUserFields.forEach((key) => {
      const field = userFields.find((userField) => userField.key === key);
      if (
        field &&
        field.type !== 'checkbox' &&
        typeof req.body[key] === 'string'
      ) {
        values[key] = req.body[key];
      }
    });
    req.flash('requiredFieldsValues', values);

    return res.redirect(`/auth/required-fields?redirect_uri=${redirectUrl}`);
  }

  let data = {};
  clientRequiredUserFields.forEach((field) => {
    if (field === 'emailNotificationConsent') {
      const clientId = String(req?.client?.id);
      const currentValue = req?.user?.emailNotificationConsent || {};
      const clientConsentIsSet = currentValue.hasOwnProperty(clientId);

      if (clientConsentIsSet) {
        data[field] = currentValue;
      } else {
        const newValue = req.body[field] === 'on' ? true : false;
        data[field] = {
          ...currentValue,
          [clientId]: newValue,
        };
      }
    } else if (field === 'privacyConsent') {
      const clientId = String(req?.client?.id);
      const currentValue = req?.user?.privacyConsentAt || {};
      const clientConsentIsSet = currentValue.hasOwnProperty(clientId);

      if (!clientConsentIsSet) {
        data['privacyConsentAt'] = {
          ...currentValue,
          [clientId]: new Date().toISOString(),
        };
      }
    } else if (field === 'email' && !!req.user.email) {
      //break;
    } else if (req.body[field]) {
      data[field] = req.body[field];
    }
  });

  req.user
    .update(data)
    .then(() => {
      const authorizeUrl = `/dialog/authorize?redirect_uri=${redirectUrl}&response_type=code&client_id=${req.client.clientId}&scope=offline`;
      res.redirect(authorizeUrl);
    })
    .catch((err) => {
      next(err);
    });
};
