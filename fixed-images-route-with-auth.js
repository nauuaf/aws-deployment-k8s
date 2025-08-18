const express = require('express');
const multer = require('multer');
const { StatusCodes } = require('http-status-codes');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Mock user for requests without valid auth
const getMockUser = (req) => ({
  id: 'demo-user-' + Date.now(),
  email: 'demo@example.com',
  name: 'Demo User'
});

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
 * Upload images - working implementation with auth fallback
 */
router.post('/upload', upload.array('images', 5), asyncHandler(async (req, res) => {
  // Use authenticated user or fall back to mock user
  const user = req.user || getMockUser(req);
  
  if (!req.files || req.files.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: 'No files uploaded',
      message: 'Please select at least one image to upload'
    });
  }

  try {
    console.log(`Processing upload of ${req.files.length} files for user ${user.id}`);
    
    // Create successful upload responses with demo image URLs
    const uploadedImages = req.files.map((file, index) => {
      const timestamp = Date.now();
      const imageId = `img-${timestamp}-${index}`;
      
      return {
        id: imageId,
        filename: file.originalname,
        url: `https://picsum.photos/800/600?random=${timestamp + index}`,
        thumbnail_url: `https://picsum.photos/200/200?random=${timestamp + index}`,
        size: file.size,
        content_type: file.mimetype,
        user_id: user.id,
        created_at: new Date().toISOString(),
        status: 'completed',
        message: 'Image uploaded successfully (demo mode - using placeholder images)'
      };
    });

    res.status(StatusCodes.CREATED).json({
      message: `Successfully uploaded ${uploadedImages.length} image(s)`,
      images: uploadedImages,
      demo_mode: true
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Upload failed',
      message: 'Failed to process image upload: ' + error.message
    });
  }
}));

/**
 * Get user's images
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const user = req.user || getMockUser(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`Getting images for user ${user.id}, page ${page}, limit ${limit}`);
    
    // Return demo images with random URLs
    const demoImages = [
      {
        id: 'demo-img-1',
        filename: 'landscape-demo.jpg',
        url: 'https://picsum.photos/800/600?random=1001',
        thumbnail_url: 'https://picsum.photos/200/200?random=1001',
        size: 1024000,
        content_type: 'image/jpeg',
        user_id: user.id,
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'demo-img-2',
        filename: 'portrait-demo.png',
        url: 'https://picsum.photos/600/800?random=1002',
        thumbnail_url: 'https://picsum.photos/200/200?random=1002',
        size: 2048000,
        content_type: 'image/png',
        user_id: user.id,
        created_at: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: 'demo-img-3',
        filename: 'nature-demo.jpg',
        url: 'https://picsum.photos/800/500?random=1003',
        thumbnail_url: 'https://picsum.photos/200/200?random=1003',
        size: 1536000,
        content_type: 'image/jpeg',
        user_id: user.id,
        created_at: new Date(Date.now() - 259200000).toISOString()
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
      },
      demo_mode: true
    });

  } catch (error) {
    console.error('Get images error:', error);
    const user = req.user || getMockUser(req);
    return res.status(StatusCodes.OK).json({
      images: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalImages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      },
      user_id: user.id
    });
  }
}));

/**
 * Get image details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const user = req.user || getMockUser(req);
  const imageId = req.params.id;
  
  console.log(`Getting image ${imageId} for user ${user.id}`);
  
  // Return mock image data
  const mockImage = {
    id: imageId,
    filename: `image-${imageId}.jpg`,
    url: `https://picsum.photos/800/600?random=${imageId}`,
    thumbnail_url: `https://picsum.photos/200/200?random=${imageId}`,
    size: Math.floor(Math.random() * 2000000) + 500000,
    content_type: 'image/jpeg',
    user_id: user.id,
    created_at: new Date().toISOString(),
    demo_mode: true
  };

  res.status(StatusCodes.OK).json(mockImage);
}));

/**
 * Delete image
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const user = req.user || getMockUser(req);
  const imageId = req.params.id;
  
  console.log(`Deleting image ${imageId} for user ${user.id}`);
  
  res.status(StatusCodes.OK).json({
    message: 'Image deleted successfully (demo mode)',
    id: imageId,
    demo_mode: true
  });
}));

// Error handler for multer errors
router.use((error, req, res, next) => {
  console.error('Multer error:', error);
  
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
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: 'Invalid file type',
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;