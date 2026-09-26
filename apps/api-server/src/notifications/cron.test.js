import { beforeEach, describe, expect, it, vi } from 'vitest';

import processQueuedNotifications from './cron.js';

function makeNotification(overrides = {}) {
  return {
    id: 1,
    projectId: 1,
    type: 'new published resource - admin',
    engine: 'email',
    from: 'noreply@example.com',
    to: 'admin@example.com',
    data: { resourceId: 1 },
    status: 'queued',
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('processQueuedNotifications', () => {
  let db;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db = {
      Notification: { scope: () => ({ findAll: vi.fn() }) },
      NotificationMessage: { create: vi.fn() },
    };
  });

  function withQueued(notifications) {
    db.Notification.scope = () => ({
      findAll: vi.fn().mockResolvedValue(notifications),
    });
  }

  it('keeps sending the next target when one target fails to render', async () => {
    const broken = makeNotification({ id: 1, projectId: 1 });
    const healthy = makeNotification({ id: 2, projectId: 2 });
    withQueued([broken, healthy]);

    const send = vi.fn().mockResolvedValue(undefined);
    db.NotificationMessage.create.mockImplementation(async (values) => {
      if (values.projectId === 1) throw new Error('template render failed');
      return { send };
    });

    await processQueuedNotifications(db);

    expect(broken.update).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect(healthy.update).toHaveBeenCalledWith({ status: 'sent' });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Queued notifications 1'),
      expect.any(Error)
    );
  });

  it('marks every notification in a sent target as sent', async () => {
    const first = makeNotification({ id: 1, data: { resourceId: 1 } });
    const second = makeNotification({ id: 2, data: { resourceId: 2 } });
    withQueued([first, second]);

    const send = vi.fn().mockResolvedValue(undefined);
    db.NotificationMessage.create.mockResolvedValue({ send });

    await processQueuedNotifications(db);

    expect(db.NotificationMessage.create).toHaveBeenCalledTimes(1);
    expect(db.NotificationMessage.create.mock.calls[0][1].data).toEqual({
      resourceId: [1, 2],
    });
    expect(first.update).toHaveBeenCalledWith({ status: 'sent' });
    expect(second.update).toHaveBeenCalledWith({ status: 'sent' });
  });
});
