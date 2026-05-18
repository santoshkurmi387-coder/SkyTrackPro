const mongoose = require('mongoose');

const historyEntrySchema = new mongoose.Schema({
  status: { type: String, required: true },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  checkedAt: { type: Date, default: Date.now },
});

const consignmentSchema = new mongoose.Schema({
  consignmentNo: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  uploadDate: {
    type: Date,
    required: true,
    index: true,
  },
  imageRef: {
    type: String,  // path or S3 URL of the bill book image
    default: null,
  },
  dailyUploadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DailyUpload',
    index: true,
  },

  // Current Status
  currentStatus: {
    type: String,
    enum: ['Booked', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Unknown'],
    default: 'Booked',
    index: true,
  },
  currentLocation: { type: String, default: '' },

  // Route Info
  origin: { type: String, default: '' },
  destination: { type: String, default: '' },

  // Delivery Info
  deliveredTo: { type: String, default: '' },
  deliveredAt: { type: Date, default: null },

  // POD
  isPODUploaded: { type: Boolean, default: false },
  podImageRef: { type: String, default: null },

  // Tracking History
  history: [historyEntrySchema],

  // Tracking Metadata
  lastChecked: { type: Date, default: null },
  scrapeError: { type: String, default: null },
  retryCount: { type: Number, default: 0 },

  // Soft archive flag
  isArchived: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Virtual: days since booking
consignmentSchema.virtual('daysSinceBooking').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual: is stale (not updated in >24h and not delivered)
consignmentSchema.virtual('isStale').get(function () {
  if (this.currentStatus === 'Delivered') return false;
  if (!this.lastChecked) return true;
  return Date.now() - this.lastChecked > 24 * 60 * 60 * 1000;
});

consignmentSchema.set('toJSON', { virtuals: true });
consignmentSchema.set('toObject', { virtuals: true });

// Indexes
consignmentSchema.index({ currentStatus: 1, uploadDate: -1 });
consignmentSchema.index({ deliveredAt: -1 });
consignmentSchema.index({ lastChecked: 1, currentStatus: 1 });

module.exports = mongoose.model('Consignment', consignmentSchema);
