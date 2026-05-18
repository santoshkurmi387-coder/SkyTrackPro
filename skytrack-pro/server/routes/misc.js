const express = require('express');
const { authenticate } = require('../middleware/auth');
const { Notification, Settings } = require('../models/index');
const { restartCronWithInterval } = require('../jobs/trackingJob');
const { runTrackingJob } = require('../jobs/trackingJob');
const Consignment = require('../models/Consignment');

// ── Notifications Router ──────────────────────────────────────────────────────
const notificationsRouter = express.Router();

notificationsRouter.get('/', authenticate, async (req, res) => {
  try {
    const { unreadOnly, page = 1, limit = 30 } = req.query;
    const query = {};
    if (unreadOnly === 'true') query.isRead = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ isRead: false }),
    ]);

    res.json({ success: true, data: notifications, total, unreadCount, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

notificationsRouter.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

notificationsRouter.patch('/mark-all-read', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

notificationsRouter.delete('/:id', authenticate, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Settings Router ───────────────────────────────────────────────────────────
const settingsRouter = express.Router();

settingsRouter.get('/', authenticate, async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) {
      settings = await Settings.create({ userId: req.user._id });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

settingsRouter.put('/', authenticate, async (req, res) => {
  try {
    const allowedFields = [
      'trackingIntervalHours', 'notifyOnDelivered', 'notifyOnOutForDelivery',
      'notifyOnException', 'notifyOnInTransit', 'ocrConfidenceThreshold',
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const settings = await Settings.findOneAndUpdate(
      { userId: req.user._id },
      updates,
      { new: true, upsert: true }
    );

    // Restart cron if interval changed
    if (updates.trackingIntervalHours) {
      await restartCronWithInterval(updates.trackingIntervalHours);
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Push Subscription Router ──────────────────────────────────────────────────
const pushRouter = express.Router();

pushRouter.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ success: false, message: 'No subscription provided' });

    await Settings.findOneAndUpdate(
      { userId: req.user._id },
      { pushSubscription: subscription },
      { upsert: true }
    );

    res.json({ success: true, message: 'Push subscription saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

pushRouter.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    await Settings.findOneAndUpdate({ userId: req.user._id }, { pushSubscription: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

pushRouter.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

// ── Stats Router ──────────────────────────────────────────────────────────────
const statsRouter = express.Router();

statsRouter.get('/', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, deliveredToday, pending, inTransit, outForDelivery, exception] = await Promise.all([
      Consignment.countDocuments({ isArchived: false }),
      Consignment.countDocuments({ currentStatus: 'Delivered', deliveredAt: { $gte: today } }),
      Consignment.countDocuments({ currentStatus: { $in: ['Booked'] }, isArchived: false }),
      Consignment.countDocuments({ currentStatus: 'In Transit', isArchived: false }),
      Consignment.countDocuments({ currentStatus: 'Out for Delivery', isArchived: false }),
      Consignment.countDocuments({ currentStatus: 'Exception', isArchived: false }),
    ]);

    // Recent activity (last 10 status changes)
    const recentActivity = await Consignment.find({ isArchived: false, lastChecked: { $ne: null } })
      .sort('-lastChecked')
      .limit(10)
      .select('consignmentNo currentStatus currentLocation lastChecked history');

    // Stale consignments (not updated in >24h)
    const staleCount = await Consignment.countDocuments({
      currentStatus: { $nin: ['Delivered'] },
      isArchived: false,
      $or: [
        { lastChecked: null },
        { lastChecked: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    });

    res.json({
      success: true,
      data: {
        total,
        deliveredToday,
        pending,
        inTransit,
        outForDelivery,
        exception,
        staleCount,
        recentActivity,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/stats/run-tracking — manually trigger tracking job
statsRouter.post('/run-tracking', authenticate, async (req, res) => {
  try {
    // Run in background
    res.json({ success: true, message: 'Tracking job started' });
    await runTrackingJob();
  } catch (err) {
    // Already responded
  }
});

module.exports = { notificationsRouter, settingsRouter, pushRouter, statsRouter };
