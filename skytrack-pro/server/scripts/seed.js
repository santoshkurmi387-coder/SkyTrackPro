/**
 * seed.js
 * Populates MongoDB with test data for development.
 * Run: cd server && npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Consignment = require('../models/Consignment');
const { DailyUpload, Notification, Settings, User } = require('../models/index');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skytrack_pro';

const STATUSES = ['Booked', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception'];
const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'];
const LOCATIONS = [
  'Gateway Hub, Mumbai',
  'IGI Sorting Center, Delhi',
  'Bengaluru Air Cargo',
  'Chennai Port Hub',
  'Hyderabad Delivery Center',
  'Howrah Hub, Kolkata',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomConsignmentNo() {
  const len = 10 + Math.floor(Math.random() * 4); // 10–13 digits
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Consignment.deleteMany({}),
    DailyUpload.deleteMany({}),
    Notification.deleteMany({}),
    Settings.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // Create admin user
  const hashedPw = await bcrypt.hash('admin123', 12);
  const adminUser = await User.create({
    username: 'admin',
    email: 'admin@skytrackpro.com',
    password: hashedPw,
    role: 'admin',
  });
  console.log('👤 Created admin user (email: admin@skytrackpro.com, password: admin123)');

  // Create settings
  await Settings.create({
    userId: adminUser._id,
    trackingIntervalHours: 5,
    notifyOnDelivered: true,
    notifyOnOutForDelivery: true,
    notifyOnException: true,
  });

  // Create daily uploads for last 7 days
  const uploads = [];
  for (let day = 0; day < 7; day++) {
    const date = daysAgo(day);
    const numbers = Array.from({ length: 8 + Math.floor(Math.random() * 7) }, () => randomConsignmentNo());
    const upload = await DailyUpload.create({
      date,
      imageUrl: `/uploads/billbooks/sample-billbook-${day}.jpg`,
      imageFilename: `sample-billbook-${day}.jpg`,
      extractedNumbers: numbers,
      confirmedNumbers: numbers,
      uploadedAt: date,
      uploadedBy: adminUser._id,
      ocrConfidence: 85 + Math.random() * 14,
      processingStatus: 'confirmed',
    });
    uploads.push({ upload, numbers, date });
  }
  console.log(`📋 Created ${uploads.length} daily uploads`);

  // Create consignments from uploads
  const consignments = [];
  const statusWeights = {
    0: ['Delivered', 'Delivered', 'Delivered', 'Exception'],           // today
    1: ['Delivered', 'Delivered', 'Out for Delivery', 'In Transit'],   // yesterday
    2: ['Delivered', 'In Transit', 'In Transit', 'Exception'],
    3: ['In Transit', 'In Transit', 'Booked', 'Delivered'],
    4: ['In Transit', 'Booked', 'Booked'],
    5: ['Booked', 'Booked', 'In Transit'],
    6: ['Booked', 'Booked', 'Booked'],
  };

  for (let day = 0; day < uploads.length; day++) {
    const { upload, numbers, date } = uploads[day];
    const weights = statusWeights[day] || ['In Transit', 'Booked'];

    for (const no of numbers) {
      const status = randomFrom(weights);
      const origin = randomFrom(CITIES);
      const destination = randomFrom(CITIES.filter(c => c !== origin));

      const history = [
        {
          status: 'Booked',
          location: `${origin} Hub`,
          description: `Consignment booked at ${origin}`,
          timestamp: new Date(date.getTime() + 2 * 3600000),
          checkedAt: new Date(date.getTime() + 2 * 3600000),
        },
      ];

      if (['In Transit', 'Out for Delivery', 'Delivered', 'Exception'].includes(status)) {
        history.push({
          status: 'In Transit',
          location: randomFrom(LOCATIONS),
          description: `In transit towards ${destination}`,
          timestamp: new Date(date.getTime() + 8 * 3600000),
          checkedAt: new Date(date.getTime() + 8 * 3600000),
        });
      }

      if (['Out for Delivery', 'Delivered'].includes(status)) {
        history.push({
          status: 'Out for Delivery',
          location: `${destination} - Local Office`,
          description: `Shipment out for delivery at ${destination}`,
          timestamp: hoursAgo(day * 12 + 6),
          checkedAt: hoursAgo(day * 12 + 6),
        });
      }

      if (status === 'Exception') {
        history.push({
          status: 'Exception',
          location: randomFrom(LOCATIONS),
          description: 'Address not found / Consignee unavailable',
          timestamp: hoursAgo(day * 8 + 3),
          checkedAt: hoursAgo(day * 8 + 3),
        });
      }

      const names = ['Rajesh Kumar', 'Priya Sharma', 'Mohammed Ali', 'Sunita Patel', 'Amit Singh', 'Neha Gupta'];
      const deliveredAt = status === 'Delivered' ? hoursAgo(day * 6 + 1) : null;

      const c = await Consignment.create({
        consignmentNo: no,
        uploadDate: date,
        imageRef: upload.imageUrl,
        dailyUploadId: upload._id,
        currentStatus: status,
        currentLocation: history[history.length - 1]?.location || '',
        origin,
        destination,
        deliveredTo: status === 'Delivered' ? randomFrom(names) : '',
        deliveredAt,
        history,
        lastChecked: day < 3 ? hoursAgo(2 + day * 3) : null,
        isPODUploaded: status === 'Delivered' && Math.random() > 0.5,
      });
      consignments.push(c);
    }
  }
  console.log(`📦 Created ${consignments.length} consignments`);

  // Create sample notifications
  const notifData = [
    { type: 'delivered', message: `Consignment #${consignments[0]?.consignmentNo} has been delivered`, consignmentNo: consignments[0]?.consignmentNo },
    { type: 'out_for_delivery', message: `Consignment #${consignments[3]?.consignmentNo} is Out for Delivery`, consignmentNo: consignments[3]?.consignmentNo },
    { type: 'exception', message: `Consignment #${consignments[6]?.consignmentNo} has an Exception — check required`, consignmentNo: consignments[6]?.consignmentNo },
    { type: 'tracking_complete', message: `Auto-tracking completed — 12 shipments updated`, consignmentNo: null },
    { type: 'delivered', message: `Consignment #${consignments[1]?.consignmentNo} has been delivered`, consignmentNo: consignments[1]?.consignmentNo, isRead: true },
    { type: 'in_transit', message: `Consignment #${consignments[9]?.consignmentNo} is now In Transit`, consignmentNo: consignments[9]?.consignmentNo, isRead: true },
  ];

  await Notification.insertMany(notifData.map((n, i) => ({
    ...n,
    isRead: n.isRead || false,
    createdAt: hoursAgo(i * 3 + 1),
  })));
  console.log(`🔔 Created ${notifData.length} notifications`);

  console.log('\n🎉 Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Login credentials:');
  console.log('  Email:    admin@skytrackpro.com');
  console.log('  Password: admin123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
