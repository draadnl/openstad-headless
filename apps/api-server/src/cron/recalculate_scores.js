const log = require('debug')('app:cron');
const config = require('config');
const { Resource, Comment } = require('../db');
const UseLock = require('../lib/use-lock');

const BATCH_SIZE =
  parseInt(process.env.RECALCULATE_SCORES_BATCH_SIZE, 10) || 100;

async function recalculateInBatches(Model) {
  let offset = 0;
  let batch;
  do {
    batch = await Model.findAll({ limit: BATCH_SIZE, offset });
    for (const record of batch) {
      record.auth.user = { role: 'admin' };
      await record.calculateAndSaveScore();
    }
    offset += batch.length;
  } while (batch.length === BATCH_SIZE);
}

// Recalculate the scores for all Resources / Comments based on existing votes
// There are hooks in place to do this on vote creation/deletion, but if those hooks
// fail for some reason (or are skipped), the scores can get out of sync. This cron job ensures
// that scores are recalculated regularly to maintain data integrity.
module.exports = {
  cronTime: '0 30 2 * * *',
  runOnInit: false,
  onTick: UseLock.createLockedExecutable({
    name: 'recalculate-scores',
    task: async (next) => {
      try {
        await recalculateInBatches(Resource);
        await recalculateInBatches(Comment);
        return next();
      } catch (err) {
        console.log('error in recalculate-scores cron');
        next(err);
      }
    },
  }),
};
