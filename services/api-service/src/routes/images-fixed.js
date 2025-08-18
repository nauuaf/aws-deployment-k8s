const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const { query, param, validationResult } = require('express-validator');
const { StatusCodes } = require('http-status-codes');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();
const imageServiceUrl = process.env.IMAGE_SERVICE_URL || 'http://image-service:5000';

// Configure multer for file uploads with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
    }
  }
});

/**
 * Upload images - properly proxy to image service
 */
router.post('/upload', upload.array('images', 5), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: 'No files uploaded',
      message: 'Please select at least one image to upload'
    });
  }

  try {
    // Create form data
    const formData = new FormData();

    // Add files to form data - properly handle buffers
    for (const file of req.files) {
      // Convert buffer to stream for proper handling
      const stream = Readable.from(file.buffer);
      formData.append('images', stream, {
        filename: file.originalname,
        contentType: file.mimetype,
        knownLength: file.buffer.length
      });
    }

    // Add other form fields
    formData.append('generate_thumbnail', req.body.generateThumbnail !== 'false' ? 'true' : 'false');
    if (req.body.quality) {
      formData.append('quality', req.body.quality);
    }

    // Get form data buffer and headers
    const formHeaders = formData.getHeaders();
    
    // Send to image service with proper configuration
    const response = await axios({
      method: 'post',
      url: `${imageServiceUrl}/upload`,
      data: formData,
      headers: {
        ...formHeaders,
        'Authorization': req.headers.authorization || ''
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 30000
    });

    res.status(StatusCodes.CREATED).json({
      message: 'Images uploaded successfully',
      ...response.data
    });

  } catch (error) {
    console.error('Upload error:', error.message);
    
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.data?.detail || 'Upload failed';
      
      if (status === 413) {
        return res.status(StatusCodes.PAYLOAD_TOO_LARGE).json({
          error: 'File too large',
          message
        });
      }
      
      if (status === 400) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Invalid upload data',
          message
        });
      }

      if (status === 401) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          error: 'Authentication required',
          message
        });
      }
      
      return res.status(status).json({
        error: 'Upload failed',
        message
      });
    }
    
    // If no response, it's likely a connection error
    return res.status(StatusCodes.BAD_GATEWAY).json({
      error: 'Service unavailable',
      message: 'Could not connect to image service'
    });
  }
}));

/**
 * Get user's images
 */
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('format')
    .optional()
    .isIn(['jpeg', 'png', 'gif', 'webp'])
    .withMessage('Format must be one of: jpeg, png, gif, webp')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    const params = new URLSearchParams({
      page: req.query.page || '1',
      limit: req.query.limit || '10'
    });

    if (req.query.format) {
      params.append('format', req.query.format);
    }

    const response = await axios.get(`${imageServiceUrl}/images`, {
      params,
      headers: {
        'Authorization': req.headers.authorization || ''
      },
      timeout: 10000
    });

    res.status(StatusCodes.OK).json(response.data);

  } catch (error) {
    console.error('Get images error:', error.message);
    
    if (error.response?.status === 404 || error.code === 'ECONNREFUSED') {
      return res.status(StatusCodes.OK).json({
        images: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalImages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      });
    }
    
    throw error;
  }
}));

/**
 * Get image details
 */
router.get('/:id', [
  param('id')
    .notEmpty()
    .withMessage('Image ID is required')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    const response = await axios.get(`${imageServiceUrl}/images/${req.params.id}`, {
      headers: {
        'Authorization': req.headers.authorization || ''
      },
      timeout: 5000
    });

    res.status(StatusCodes.OK).json(response.data);

  } catch (error) {
    if (error.response?.status === 404) {
      throw new NotFoundError('Image not found');
    }
    
    if (error.response?.status === 403) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to access this image'
      });
    }
    
    throw error;
  }
}));

/**
 * Delete image
 */
router.delete('/:id', [
  param('id')
    .notEmpty()
    .withMessage('Image ID is required')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    await axios.delete(`${imageServiceUrl}/images/${req.params.id}`, {
      headers: {
        'Authorization': req.headers.authorization || ''
      },
      timeout: 10000
    });

    res.status(StatusCodes.OK).json({
      message: 'Image deleted successfully'
    });

  } catch (error) {
    if (error.response?.status === 404) {
      throw new NotFoundError('Image not found');
    }
    
    if (error.response?.status === 403) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to delete this image'
      });
    }
    
    throw error;
  }
}));

/**
 * Process image
 */
router.post('/:id/process', [
  param('id')
    .notEmpty()
    .withMessage('Image ID is required')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    const response = await axios.post(`${imageServiceUrl}/images/${req.params.id}/process`, req.body, {
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds for processing
    });

    res.status(StatusCodes.OK).json({
      message: 'Image processed successfully',
      ...response.data
    });

  } catch (error) {
    if (error.response?.status === 404) {
      throw new NotFoundError('Image not found');
    }
    
    if (error.response?.status === 400) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Invalid processing parameters',
        message: error.response.data?.message || 'The provided processing parameters are invalid'
      });
    }
    
    if (error.response?.status === 403) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to process this image'
      });
    }
    
    throw error;
  }
}));

// Error handler for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(StatusCodes.PAYLOAD_TOO_LARGE).json({
        error: 'File too large',
        message: 'File size exceeds the 10MB limit'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Too many files',
        message: 'Maximum 5 files allowed per upload'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Unexpected file field',
        message: 'Use "images" field for file uploads'
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: 'Invalid file type',
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;