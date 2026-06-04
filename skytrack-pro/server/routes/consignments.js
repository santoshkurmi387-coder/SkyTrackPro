const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Consignment = require('../models/Consignment');
const { trackConsignment } = require('../services/scraper');
const { notifyStatusChange } = require('../services/notificationService');
const logger = require('../services/logger');

const router = express.Router();

const podDir = path.join(__dirname, '../uploads/pod');
if (!fs.existsSync(podDir)) fs.mkdirSync(podDir, { recursive: true });

const podStorage = multer.diskStorage({
  destination: podDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `pod-${uuidv4()}${ext}`);
  },
});
const podUpload = multer({ storage: podStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  try {
    const { status, date, dateFrom, dateTo, page = 1, limit = 50, sort = '-uploadDate', search, delivered, pending } = req.query;
    const query = { isArchived: false };
    if (status) query.currentStatus = status;
    if (search) query.consignmentNo = { $regex: search, $options: 'i' };
    if (date) {
      const d = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      query.uploadDate = { $gte: start, $lte: end };
    } else if (dateFrom || dateTo) {
      query.uploadDate = {};
      if (dateFrom) query.uploadDate.$gte = new Date(dateFrom);
      if (dateTo) query.uploadDate.$lte = new Date(dateTo);
    }
    if (delivered === 'true') {
      query.currentStatus = 'Delivered';
      query.deliveredAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    } else if (pending === 'true') {
      query.currentStatus = { $nin: ['Delivered'] };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [consignments, total] = await Promise.all([
      Consignment.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      Consignment.countDocuments(query),
    ]);
    res.json({ success: true, data: consignments, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { status, dateFrom, dateTo } = req.query;
    const query = { isArchived: false };
    if (status) query.currentStatus = status;
    if (dateFrom || dateTo) {
      query.uploadDate = {};
      if (dateFrom) query.uploadDate.$gte = new Date(dateFrom);
      if (dateTo) query.uploadDate.$lte = new Date(dateTo);
    }
    const consignments = await Consignment.find(query).sort('-uploadDate');
    const headers = ['Consignment No', 'Upload Date', 'Status', 'Location', 'Origin', 'Destination', 'Delivered At', 'Delivered To', 'Last Checked'];
    const rows = consignments.map(c => [c.consignmentNo, c.uploadDate?.toLocaleDateString('en-IN'), c.currentStatus, c.currentLocation || '', c.origin || '', c.destination || '', c.deliveredAt?.toLocaleString('en-IN') || '', c.deliveredTo || '', c.lastChecked?.toLocaleString('en-IN') || 'Never']);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="consignments.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const consignment = await Consignment.findById(req.params.id);
    if (!consignment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: consignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/no/:consignmentNo', async (req, res) => {
  try {
    const consignment = await Consignment.findOne({ consignmentNo: req.params.consignmentNo });
    if (!consignment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: consignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/track', async (req, res) => {
  try {
    const consignment = await Consignment.findById(req.params.id);
    if (!consignment) return res.status(404).json({ success: false, message: 'Not found' });
    const result = await trackConsignment(consignment.consignmentNo);
    if (!result.success) {
      consignment.scrapeError = result.error;
      consignment.lastChecked = new Date();
      await consignment.save();
      return res.status(502).json({ success: false, message: result.error });
    }
    const oldStatus = consignment.currentStatus;
    consignment.currentStatus = result.currentStatus;
    consignment.currentLocation = result.currentLocation || consignment.currentLocation;
    consignment.origin = result.origin || consignment.origin;
    consignment.destination = result.destination || consignment.destination;
    consignment.lastChecked = new Date();
    consignment.scrapeError = null;
    if (result.history?.length > 0) {
      const existingTimestamps = new Set(consignment.history.map(h => h.timestamp?.toISOString()));
      const newEntries = result.history.filter(h => !existingTimestamps.has(new Date(h.timestamp)?.toISOString()));
      consignment.history.push(...newEntries);
    }
    if (result.currentStatus === 'Delivered' && !consignment.deliveredAt) {
      consignment.deliveredAt = new Date();
      consignment.deliveredTo = result.deliveredTo || '';
    }
    await consignment.save();
    if (oldStatus !== result.currentStatus) await notifyStatusChange(consignment, oldStatus, result.currentStatus);
    res.json({ success: true, data: consignment, statusChanged: oldStatus !== result.currentStatus });
  } catch (err) {
    logger.error(`Manual track error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/bulk-track', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'No IDs provided' });
    res.json({ success: true, message: `Tracking ${ids.length} consignment(s) in background` });
    const consignments = await Consignment.find({ _id: { $in: ids } });
    for (const c of consignments) {
      const result = await trackConsignment(c.consignmentNo);
      if (result.success) {
        const oldStatus = c.currentStatus;
        c.currentStatus = result.currentStatus;
        c.currentLocation = result.currentLocation || c.currentLocation;
        c.lastChecked = new Date();
        await c.save();
        if (oldStatus !== result.currentStatus) await notifyStatusChange(c, oldStatus, result.currentStatus);
      }
    }
  } catch (err) {
    logger.error(`Bulk track error: ${err.message}`);
  }
});

router.post('/:id/pod', podUpload.single('pod'), async (req, res) => {
  try {
    const consignment = await Consignment.findById(req.params.id);
    if (!consignment) return res.status(404).json({ success: false, message: 'Not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    if (consignment.podImageRef) {
      const oldPath = path.join(__dirname, '..', consignment.podImageRef);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    consignment.podImageRef = `/uploads/pod/${req.file.filename}`;
    consignment.isPODUploaded = true;
    await consignment.save();
    res.json({ success: true, podImageRef: consignment.podImageRef });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Consignment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
