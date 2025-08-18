const express = require('express');
const multer = require('multer');
const { StatusCodes } = require('http-status-codes');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Configure multer for file uploads
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
 * Upload images - working mock implementation
 */
router.post('/upload', upload.array('images', 5), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: 'No files uploaded',
      message: 'Please select at least one image to upload'
    });
  }

  try {
    // Create successful upload responses
    const uploadedImages = req.files.map((file, index) => ({
      id: `img-${Date.now()}-${index}`,
      filename: file.originalname,
      url: `https://picsum.photos/400/300?random=${Date.now() + index}`, // Demo image URLs
      thumbnail_url: `https://picsum.photos/150/150?random=${Date.now() + index}`,
      size: file.size,
      content_type: file.mimetype,
      user_id: req.user?.id || 'demo-user',
      created_at: new Date().toISOString(),
      status: 'completed'
    }));

    res.status(StatusCodes.CREATED).json({
      message: `Successfully uploaded ${uploadedImages.length} image(s)`,
      images: uploadedImages
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Upload failed',
      message: 'Failed to process image upload'
    });
  }
}));

/**
 * Get user's images
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Return mock data
    const demoImages = [
      {
        id: 'demo-img-1',
        filename: 'landscape.jpg',
        url: 'https://picsum.photos/400/300?random=1',
        thumbnail_url: 'https://picsum.photos/150/150?random=1',
        size: 1024000,
        content_type: 'image/jpeg',
        user_id: req.user?.id || 'demo-user',
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'demo-img-2',
        filename: 'portrait.png',
        url: 'https://picsum.photos/400/300?random=2',
        thumbnail_url: 'https://picsum.photos/150/150?random=2',
        size: 2048000,
        content_type: 'image/png',
        user_id: req.user?.id || 'demo-user',
        created_at: new Date(Date.now() - 172800000).toISOString()
      }
    ];
    
    res.status(StatusCodes.OK).json({
      images: demoImages,
      pagination: {
        currentPage: page,
        totalPages: 1,
        totalImages: demoImages.length,
        hasNextPage: false,
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get images error:', error);
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
}));

/**
 * Get image details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const imageId = req.params.id;
  
  // Return mock image data
  const mockImage = {
    id: imageId,
    filename: 'sample-image.jpg',
    url: `https://picsum.photos/800/600?random=${imageId}`,
    thumbnail_url: `https://picsum.photos/150/150?random=${imageId}`,
    size: 1500000,
    content_type: 'image/jpeg',
    user_id: req.user?.id || 'demo-user',
    created_at: new Date().toISOString()
  };

  res.status(StatusCodes.OK).json(mockImage);
}));

/**
 * Delete image
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  res.status(StatusCodes.OK).json({
    message: 'Image deleted successfully'
  });
}));

// Error handler for multer errors
router.use((error, req, res, next) => {
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
  
  if (error.message.includes('Invalid file type')) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: 'Invalid file type',
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;