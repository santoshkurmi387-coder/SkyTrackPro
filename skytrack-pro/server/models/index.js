const mongoose = require('mongoose');

// ── DailyUpload Model ─────────────────────────────────────────────────────────
const dailyUploadSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  imageFilename: {
    type: String,
    required: true,
  },
  extractedNumbers: [{
    type: String,
    trim: true,
  }],
  confirmedNumbers: [{
    type: String,
    trim: true,
  }],
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  ocrConfidence: {
    type: Number,
    default: null,
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'ocr_processing', 'awaiting_confirmation', 'confirmed', 'error'],
    default: 'pending',
  },
  processingError: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

dailyUploadSchema.index({ date: -1 });

// ── Notification Model ────────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  consignmentNo: {
    type: String,
    index: true,
  },
  type: {
    type: String,
    enum: ['delivered', 'out_for_delivery', 'exception', 'tracking_complete', 'in_transit', 'info'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    default: '',
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ isRead: 1, createdAt: -1 });

// ── Settings Model ────────────────────────────────────────────────────────────
const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
  },
  trackingIntervalHours: {
    type: Number,
    enum: [2, 5, 12, 24],
    default: 5,
  },
  notifyOnDelivered: { type: Boolean, default: true },
  notifyOnOutForDelivery: { type: Boolean, default: true },
  notifyOnException: { type: Boolean, default: true },
  notifyOnInTransit: { type: Boolean, default: false },
  ocrConfidenceThreshold: { type: Number, default: 60, min: 0, max: 100 },
  pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null },
}, {
  timestamps: true,
});

// ── User Model ────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

module.exports = {
  DailyUpload: mongoose.model('DailyUpload', dailyUploadSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  Settings: mongoose.model('Settings', settingsSchema),
  User: mongoose.model('User', userSchema),
};
