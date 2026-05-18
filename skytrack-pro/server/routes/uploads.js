const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { performOCR, validateConsignmentNumbers } = require('../services/ocr');
const { DailyUpload } = require('../models/index');
const Consignment = require('../models/Consignment');
const logger = require('../services/logger');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/billbooks');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `billbook-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP, BMP, TIFF) are allowed'));
    }
  },
});

// POST /api/uploads — upload image and run OCR
router.post('/', authenticate, upload.single('billbook'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const dateStr = req.body.date || new Date().toISOString().split('T')[0];
    const uploadDate = new Date(dateStr);

    // Create DB record
    const dailyUpload = await DailyUpload.create({
      date: uploadDate,
      imageUrl: `/uploads/billbooks/${req.file.filename}`,
      imageFilename: req.file.filename,
      extractedNumbers: [],
      confirmedNumbers: [],
      uploadedAt: new Date(),
      uploadedBy: req.user._id,
      processingStatus: 'ocr_processing',
    });

    // Run OCR asynchronously
    res.json({
      success: true,
      uploadId: dailyUpload._id,
      imageUrl: dailyUpload.imageUrl,
      status: 'processing',
      message: 'Image uploaded. OCR processing started.',
    });

    // Process OCR in background
    try {
      const { numbers, confidence, rawText } = await performOCR(req.file.path);
      const validatedNumbers = validateConsignmentNumbers(numbers);

      await DailyUpload.findByIdAndUpdate(dailyUpload._id, {
        extractedNumbers: validatedNumbers,
        ocrConfidence: confidence,
        processingStatus: 'awaiting_confirmation',
      });

      logger.info(`OCR complete for upload ${dailyUpload._id}: ${validatedNumbers.length} numbers found`);
    } catch (ocrErr) {
      logger.error(`OCR failed for upload ${dailyUpload._id}: ${ocrErr.message}`);
      await DailyUpload.findByIdAndUpdate(dailyUpload._id, {
        processingStatus: 'error',
        processingError: ocrErr.message,
      });
    }

  } catch (err) {
    logger.error(`Upload error: ${err.message}`);
    // Clean up file if DB insert failed
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/uploads/:id/status — poll OCR status
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const upload = await DailyUpload.findById(req.params.id);
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' });

    res.json({
      success: true,
      status: upload.processingStatus,
      extractedNumbers: upload.extractedNumbers,
      ocrConfidence: upload.ocrConfidence,
      error: upload.processingError,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/uploads/:id/confirm — confirm extracted numbers
router.post('/:id/confirm', authenticate, async (req, res) => {
  try {
    const { confirmedNumbers } = req.body;

    if (!Array.isArray(confirmedNumbers) || confirmedNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'No numbers confirmed' });
    }

    const upload = await DailyUpload.findById(req.params.id);
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' });

    // Check for existing consignments to avoid duplicates
    const existingNos = await Consignment.find({
      consignmentNo: { $in: confirmedNumbers },
    }).select('consignmentNo');
    const existingSet = new Set(existingNos.map(c => c.consignmentNo));

    const newNumbers = confirmedNumbers.filter(n => !existingSet.has(n));
    const duplicates = confirmedNumbers.filter(n => existingSet.has(n));

    // Create consignment records for new numbers
    if (newNumbers.length > 0) {
      await Consignment.insertMany(newNumbers.map(no => ({
        consignmentNo: no,
        uploadDate: upload.date,
        imageRef: upload.imageUrl,
        dailyUploadId: upload._id,
        currentStatus: 'Booked',
        history: [{
          status: 'Booked',
          location: '',
          description: 'Consignment added from bill book',
          timestamp: new Date(),
          checkedAt: new Date(),
        }],
      })));
    }

    // Update upload record
    await DailyUpload.findByIdAndUpdate(req.params.id, {
      confirmedNumbers,
      processingStatus: 'confirmed',
    });

    res.json({
      success: true,
      added: newNumbers.length,
      duplicates: duplicates.length,
      newNumbers,
      duplicateNumbers: duplicates,
      message: `Added ${newNumbers.length} new consignment(s). ${duplicates.length} already tracked.`,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/uploads — list all uploads (paginated)
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [uploads, total] = await Promise.all([
      DailyUpload.find()
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('uploadedBy', 'username'),
      DailyUpload.countDocuments(),
    ]);

    res.json({
      success: true,
      data: uploads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/uploads/:id — delete an upload
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const upload = await DailyUpload.findById(req.params.id);
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' });

    // Delete file from disk
    const filePath = path.join(__dirname, '..', upload.imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await DailyUpload.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Upload deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
