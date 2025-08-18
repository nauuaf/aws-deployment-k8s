const express = require('express');
const http = require('http');
const { StatusCodes } = require('http-status-codes');

const router = express.Router();
const imageServiceHost = process.env.IMAGE_SERVICE_URL?.replace('http://', '') || 'image-service:5000';

// Raw proxy that streams the request directly
router.use('*', (req, res) => {
  // Remove /api/images from the path
  const targetPath = req.originalUrl.replace('/api/images', '');
  
  console.log(`Proxying ${req.method} ${req.originalUrl} -> http://${imageServiceHost}${targetPath}`);
  
  // Create proxy request
  const options = {
    hostname: imageServiceHost.split(':')[0],
    port: parseInt(imageServiceHost.split(':')[1]) || 5000,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: imageServiceHost, // Set correct host
    }
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    // Forward status and headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Pipe response
    proxyRes.pipe(res);
  });
  
  // Handle proxy errors
  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error.message);
    
    if (!res.headersSent) {
      res.status(StatusCodes.BAD_GATEWAY).json({
        error: 'Service unavailable',
        message: 'Could not connect to image service'
      });
    }
  });
  
  // Pipe request body
  req.pipe(proxyReq);
});

module.exports = router;