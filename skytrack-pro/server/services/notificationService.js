/**
 * notificationService.js
 * Handles web push notifications and in-app notification creation.
 */

const webpush = require('web-push');
const { Notification, Settings } = require('../models/index');
const logger = require('./logger');

function setupWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:admin@skytrackpro.com';

  if (!publicKey || !privateKey) {
    logger.warn('⚠️  VAPID keys not configured — web push notifications disabled');
    return;
  }

  webpush.setVapidDetails(email, publicKey, privateKey);
  logger.info('🔔 Web Push (VAPID) initialized');
}

/**
 * Create an in-app notification record.
 */
async function createNotification({ consignmentNo, type, message, details = '', userId = null }) {
  try {
    const notif = await Notification.create({
      consignmentNo,
      type,
      message,
      details,
      userId,
      isRead: false,
    });
    return notif;
  } catch (err) {
    logger.error(`Failed to create notification: ${err.message}`);
    return null;
  }
}

/**
 * Send a web push notification to all subscribed users.
 */
async function sendPushNotification(payload) {
  try {
    const settings = await Settings.find({ pushSubscription: { $ne: null } });

    if (settings.length === 0) {
      logger.debug('No push subscriptions found');
      return;
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/logo192.png',
      badge: '/badge.png',
      tag: payload.tag || 'skytrack-update',
      data: { consignmentNo: payload.consignmentNo, url: '/' },
    });

    const results = await Promise.allSettled(
      settings.map(setting =>
        webpush.sendNotification(setting.pushSubscription, pushPayload)
      )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info(`🔔 Push notifications: ${succeeded} sent, ${failed} failed`);

    // Clean up invalid subscriptions
    results.forEach(async (result, i) => {
      if (result.status === 'rejected' && result.reason?.statusCode === 410) {
        // Subscription expired/unsubscribed
        await Settings.findByIdAndUpdate(settings[i]._id, { pushSubscription: null });
      }
    });

  } catch (err) {
    logger.error(`Push notification error: ${err.message}`);
  }
}

/**
 * Notify about a status change for a consignment.
 */
async function notifyStatusChange(consignment, oldStatus, newStatus) {
  const cNo = consignment.consignmentNo;
  let type, message, title, body;

  if (newStatus === 'Delivered') {
    type = 'delivered';
    message = `Consignment #${cNo} has been delivered`;
    title = '✅ Delivered!';
    body = `Consignment #${cNo} was delivered${consignment.deliveredTo ? ` to ${consignment.deliveredTo}` : ''}`;
  } else if (newStatus === 'Out for Delivery') {
    type = 'out_for_delivery';
    message = `Consignment #${cNo} is Out for Delivery`;
    title = '🚚 Out for Delivery';
    body = `Consignment #${cNo} is on its way!`;
  } else if (newStatus === 'Exception') {
    type = 'exception';
    message = `Consignment #${cNo} has an exception — check required`;
    title = '⚠️ Exception Alert';
    body = `Consignment #${cNo} requires attention`;
  } else if (newStatus === 'In Transit') {
    type = 'in_transit';
    message = `Consignment #${cNo} is now In Transit`;
    title = '📦 In Transit';
    body = `Consignment #${cNo} is in transit${consignment.currentLocation ? ` at ${consignment.currentLocation}` : ''}`;
  } else {
    return; // Don't notify for other status changes
  }

  // Create in-app notification
  await createNotification({
    consignmentNo: cNo,
    type,
    message,
    details: `Status changed from ${oldStatus} to ${newStatus}`,
  });

  // Send push notification for important events
  if (['Delivered', 'Exception'].includes(newStatus)) {
    await sendPushNotification({ title, body, consignmentNo: cNo, tag: `${type}-${cNo}` });
  }
}

/**
 * Notify when an auto-tracking job completes.
 */
async function notifyTrackingComplete(updatedCount, totalCount) {
  if (updatedCount > 0) {
    await createNotification({
      type: 'tracking_complete',
      message: `Auto-tracking completed — ${updatedCount} of ${totalCount} shipments updated`,
      consignmentNo: null,
    });
  }
}

module.exports = {
  setupWebPush,
  createNotification,
  sendPushNotification,
  notifyStatusChange,
  notifyTrackingComplete,
};
