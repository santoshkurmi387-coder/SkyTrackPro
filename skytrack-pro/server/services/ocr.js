/**
 * ocr.js
 * Server-side OCR service using Tesseract.js or Google Vision API.
 * Extracts consignment numbers (10–14 digit numeric strings) from bill book images.
 */

const Tesseract = require('tesseract.js');
const path = require('path');
const logger = require('./logger');

const OCR_ENGINE = process.env.OCR_ENGINE || 'tesseract';
const CONFIDENCE_THRESHOLD = 60;

// Regex: numeric sequences of 10–14 digits (consignment numbers)
const CONSIGNMENT_REGEX = /\b\d{10,14}\b/g;

/**
 * Extract consignment numbers from an image file using Tesseract.js.
 * @param {string} imagePath - absolute path to the image file
 * @returns {{ numbers: string[], confidence: number, rawText: string }}
 */
async function extractWithTesseract(imagePath) {
  logger.info(`🔍 Running Tesseract OCR on: ${path.basename(imagePath)}`);

  const result = await Tesseract.recognize(imagePath, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  const rawText = result.data.text;
  const confidence = result.data.confidence;

  logger.info(`📄 OCR completed. Confidence: ${confidence.toFixed(1)}%`);
  logger.debug(`Raw OCR text (first 500 chars):\n${rawText.substring(0, 500)}`);

  // Extract all matching consignment numbers
  const matches = rawText.match(CONSIGNMENT_REGEX) || [];
  const uniqueNumbers = [...new Set(matches)];

  logger.info(`📦 Found ${uniqueNumbers.length} consignment number(s): ${uniqueNumbers.join(', ')}`);

  return {
    numbers: uniqueNumbers,
    confidence,
    rawText,
  };
}

/**
 * Extract consignment numbers using Google Vision API.
 * Requires GOOGLE_VISION_API_KEY in environment.
 * @param {string} imagePath - absolute path to the image file
 */
async function extractWithGoogleVision(imagePath) {
  const fs = require('fs');
  const axios = require('axios');

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_VISION_API_KEY not set in environment');
  }

  logger.info(`🔍 Running Google Vision OCR on: ${path.basename(imagePath)}`);

  // Read image as base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const response = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      requests: [{
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION' }],
      }],
    }
  );

  const annotations = response.data.responses[0];

  if (annotations.error) {
    throw new Error(`Google Vision API error: ${annotations.error.message}`);
  }

  const rawText = annotations.fullTextAnnotation?.text || '';
  logger.info('📄 Google Vision OCR completed');

  const matches = rawText.match(CONSIGNMENT_REGEX) || [];
  const uniqueNumbers = [...new Set(matches)];

  logger.info(`📦 Found ${uniqueNumbers.length} consignment number(s): ${uniqueNumbers.join(', ')}`);

  return {
    numbers: uniqueNumbers,
    confidence: 95, // Google Vision doesn't return a single confidence; assume high
    rawText,
  };
}

/**
 * Main OCR function — delegates to the configured engine.
 * @param {string} imagePath
 * @returns {{ numbers: string[], confidence: number, rawText: string }}
 */
async function performOCR(imagePath) {
  if (OCR_ENGINE === 'google') {
    return await extractWithGoogleVision(imagePath);
  }
  return await extractWithTesseract(imagePath);
}

/**
 * Validate a list of candidate consignment numbers.
 * Filters out obvious false positives (phone numbers, dates, etc.)
 * @param {string[]} candidates
 * @returns {string[]}
 */
function validateConsignmentNumbers(candidates) {
  return candidates.filter((num) => {
    // Must be purely numeric
    if (!/^\d+$/.test(num)) return false;

    // Must be 10–14 digits
    if (num.length < 10 || num.length > 14) return false;

    // Filter obvious non-consignment patterns
    // (e.g., all same digit: 1111111111)
    const uniqueDigits = new Set(num.split('')).size;
    if (uniqueDigits < 3) return false;

    return true;
  });
}

module.exports = { performOCR, validateConsignmentNumbers, CONSIGNMENT_REGEX };
