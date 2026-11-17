'use strict';

const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../db');
const utils = require('../utils');

// The access tokens.
// You will use these to access your end point data through the means outlined
// in the RFC The OAuth 2.0 Authorization Framework: Bearer Token Usage
// (http://tools.ietf.org/html/rfc6750)

/**
 * Tokens in-memory data structure which stores all of the access tokens
 */
let tokens = Object.create(null);

/**
 * Returns an access token if it finds one, otherwise returns null if one is not found.
 * @param   {String}  token - The token to decode to get the id of the access token to find.
 * @returns {Promise} resolved with the token if found, otherwise resolved with undefined
 */
exports.find = (token) => {
  const findAction = new Promise((resolve, reject) => {
    let decoded;
    try {
      decoded = utils.verifyToken(token);
    } catch (e) {
      console.warn('Error verifying JWT: ', e);
      return resolve(undefined);
    }

    const id = decoded.jti;

    db.AccessToken.findOne({ where: { tokenId: id } })
      .then((token) => {
        if (!token) {
          resolve(undefined);
        }
        return resolve(token);
      })
      .catch((e) => {
        console.warn('Error finding accesstoken: ', e);
        return resolve(undefined);
      });
  });

  return findAction;
};

/**
 * Saves a access token, expiration date, user id, client id, and scope. Note: The actual full
 * access token is never saved.  Instead just the ID of the token is saved.  In case of a database
 * breach this prevents anyone from stealing the live tokens.
 * @param   {Object}  token          - The access token (required)
 * @param   {Date}    expirationDate - The expiration of the access token (required)
 * @param   {String}  userID         - The user ID (required)
 * @param   {String}  clientID       - The client ID (required)
 * @param   {String}  scope          - The scope (optional)
 * @returns {Promise} resolved with the saved token
 */
exports.save = (token, expirationDate, userID, clientID, scope) => {
  const saveAction = new Promise((resolve, reject) => {
    let decoded;
    try {
      decoded = utils.verifyToken(token);
    } catch (e) {
      console.warn('Error verifying JWT: ', e);
      return resolve(undefined);
    }

    const id = decoded.jti;

    db.AccessToken.create({
      tokenId: id,
      userID,
      expirationDate,
      clientID,
      scope,
    })
      .then((token) => {
        console.log(
          `[${new Date().toISOString()}][auth] access token saved: userId=${userID} clientId=${clientID}`
        );
        if (!token) {
          resolve(undefined);
        }
        return resolve(token);
      })
      .catch((e) => {
        console.warn('Error creating accesstoken: ', e);
        return resolve(undefined);
      });
  });

  return saveAction;
};

/**
 * Deletes/Revokes an access token by getting the ID and removing it from the storage.
 * @param   {String}  token - The token to decode to get the id of the access token to delete.
 * @returns {Promise} resolved with the deleted token
 */
exports.delete = (token) => {
  const deleteAction = new Promise((resolve, reject) => {
    let decoded;
    try {
      decoded = utils.verifyToken(token);
    } catch (e) {
      console.warn('Error verifying JWT: ', e);
      return resolve(undefined);
    }

    const id = decoded.jti;

    db.AccessToken.findOne({ where: { tokenId: id } })
      .then((token) => {
        return token
          .destroy()
          .then(() => {
            return token ? resolve(token) : resolve(undefined);
          })
          .catch(() => {
            console.warn('Error delete accesstoken: ', e);
            return resolve(undefined);
          });
      })
      .catch((e) => {
        console.warn('Error delete accesstoken: ', e);
        return resolve(undefined);
      });
  });

  return deleteAction;
};

/**
 * Removes expired access tokens with a single DELETE. Loading every token to
 * compare dates in Node needs about 1.5 KB of heap per row, which is enough to
 * run the server out of memory once the table has grown.
 * @returns {Promise} resolved when the cleanup is done; never rejects
 */
exports.removeExpired = () =>
  db.AccessToken.destroy({
    where: { expirationDate: { [Op.lt]: new Date() } },
  })
    .then((count) => {
      console.log(
        `[${new Date().toISOString()}][auth] cleaned up ${count} expired tokens`
      );
    })
    .catch((e) => {
      console.warn(
        `[${new Date().toISOString()}][auth] token cleanup error: ${e?.message}`
      );
    });

/**
 * Removes all access tokens.
 * @returns {Promise} resolved with all removed tokens returned
 */
exports.removeAll = () => {
  //const deletedTokens = tokens;
  //tokens              = Object.create(null);
  // return Promise.resolve(deletedTokens);
};
