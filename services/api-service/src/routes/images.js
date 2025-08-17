const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { query, param, validationResult } = require('express-validator');
const { StatusCodes } = require('http-status-codes');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();
const imageServiceUrl = process.env.IMAGE_SERVICE_URL || 'http://image-service:5000';

// Configure multer for file uploads
const upload = multer({
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
 * @swagger
 * components:
 *   schemas:
 *     Image:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Image ID
 *         filename:
 *           type: string
 *           description: Original filename
 *         url:
 *           type: string
 *           description: Image URL
 *         thumbnailUrl:
 *           type: string
 *           description: Thumbnail URL
 *         size:
 *           type: number
 *           description: File size in bytes
 *         mimeType:
 *           type: string
 *           description: MIME type of the image
 *         width:
 *           type: number
 *           description: Image width in pixels
 *         height:
 *           type: number
 *           description: Image height in pixels
 *         uploadedBy:
 *           type: string
 *           description: User ID who uploaded the image
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Upload timestamp
 */

/**
 * @swagger
 * /api/images/upload:
 *   post:
 *     summary: Upload images
 *     description: Upload one or multiple images
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files to upload
 *               generateThumbnail:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to generate thumbnails
 *               quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 85
 *                 description: Image quality (1-100)
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 images:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Image'
 *       400:
 *         description: Validation error or invalid files
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File too large
 *       500:
 *         description: Internal server error
 */
router.post('/upload', upload.array('images', 5), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: 'No files uploaded',
      message: 'Please select at least one image to upload'
    });
  }

  try {
    // Prepare form data for image service
    const FormData = require('form-data');
    const formData = new FormData();

    // Add files to form data
    req.files.forEach((file, index) => {
      formData.append('images', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    });

    // Add additional parameters
    formData.append('uploadedBy', req.user.id);
    formData.append('generateThumbnail', req.body.generateThumbnail !== 'false');
    
    if (req.body.quality) {
      const quality = parseInt(req.body.quality, 10);
      if (quality >= 1 && quality <= 100) {
        formData.append('quality', quality);
      }
    }

    // Send to image service
    const response = await axios.post(`${imageServiceUrl}/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': req.headers.authorization
      },
      timeout: 30000, // 30 seconds for upload
      maxContentLength: 50 * 1024 * 1024 // 50MB
    });

    res.status(StatusCodes.CREATED).json({
      message: 'Images uploaded successfully',
      ...response.data
    });

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Upload failed';
      
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
    }
    
    throw error;
  }
}));

/**
 * @swagger
 * /api/images:
 *   get:
 *     summary: Get user's images
 *     description: Retrieve a list of images uploaded by the authenticated user
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of images per page
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [jpeg, png, gif, webp]
 *         description: Filter by image format
 *     responses:
 *       200:
 *         description: Images retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Image'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalImages:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPreviousPage:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
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
      userId: req.user.id,
      page: req.query.page || '1',
      limit: req.query.limit || '10'
    });

    if (req.query.format) {
      params.append('format', req.query.format);
    }

    const response = await axios.get(`${imageServiceUrl}/images?${params}`, {
      headers: {
        'Authorization': req.headers.authorization
      },
      timeout: 10000
    });

    res.status(StatusCodes.OK).json(response.data);

  } catch (error) {
    if (error.response?.status === 404) {
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
 * @swagger
 * /api/images/{id}:
 *   get:
 *     summary: Get image details
 *     description: Retrieve details of a specific image
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Image ID
 *     responses:
 *       200:
 *         description: Image details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Image'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Image not found
 *       500:
 *         description: Internal server error
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
        'Authorization': req.headers.authorization
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
 * @swagger
 * /api/images/{id}:
 *   delete:
 *     summary: Delete image
 *     description: Delete a specific image
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Image ID
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Image not found
 *       500:
 *         description: Internal server error
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
        'Authorization': req.headers.authorization
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
 * @swagger
 * /api/images/{id}/process:
 *   post:
 *     summary: Process image
 *     description: Apply processing operations to an image
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Image ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [resize, crop, rotate, filter]
 *                     params:
 *                       type: object
 *                       description: Operation-specific parameters
 *               format:
 *                 type: string
 *                 enum: [jpeg, png, webp]
 *                 default: jpeg
 *               quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 85
 *     responses:
 *       200:
 *         description: Image processed successfully
 *       400:
 *         description: Invalid processing parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Image not found
 *       500:
 *         description: Internal server error
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
        'Authorization': req.headers.authorization,
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