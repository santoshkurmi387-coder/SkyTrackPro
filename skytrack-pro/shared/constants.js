/**
 * shared/constants.js
 * Shared constants used across the application.
 * Importable by both server (Node.js) and client (React).
 */

const CONSIGNMENT_STATUSES = {
  BOOKED: 'Booked',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  EXCEPTION: 'Exception',
  UNKNOWN: 'Unknown',
};

const NOTIFICATION_TYPES = {
  DELIVERED: 'delivered',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  EXCEPTION: 'exception',
  TRACKING_COMPLETE: 'tracking_complete',
  IN_TRANSIT: 'in_transit',
  INFO: 'info',
};

const TRACKING_INTERVALS = [2, 5, 12, 24]; // hours

// Regex to match consignment numbers (10–14 digit sequences)
const CONSIGNMENT_REGEX_STR = '\\b\\d{10,14}\\b';

const STATUS_COLORS = {
  Booked: '#6B7280',
  'In Transit': '#3B82F6',
  'Out for Delivery': '#8B5CF6',
  Delivered: '#10B981',
  Exception: '#EF4444',
  Unknown: '#6B7280',
};

module.exports = {
  CONSIGNMENT_STATUSES,
  NOTIFICATION_TYPES,
  TRACKING_INTERVALS,
  CONSIGNMENT_REGEX_STR,
  STATUS_COLORS,
};
