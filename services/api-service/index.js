const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const prometheus = require('prom-client');
const winston = require('winston');
const expressWinston = require('express-winston');
const { StatusCodes } = require('http-status-codes');
require('dotenv').config();

// Import route handlers
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const imageRoutes = require('./src/routes/images');
const healthRoutes = require('./src/routes/health');
const chaosRoutes = require('./src/routes/chaos');

// Import middleware
const { authMiddleware } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/errorHandler');
const metrics = require('./src/middleware/metrics');

// Configuration
const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:8080',
  imageServiceUrl: process.env.IMAGE_SERVICE_URL || 'http://image-service:5000',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || 5432,
  dbName: process.env.DB_NAME || 'sredb',
  dbUser: process.env.DB_USER || 'sreuser',
  dbPassword: process.env.DB_PASSWORD || 'password',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // limit each IP to 100 requests per windowMs
};

// Initialize Express app
const app = express();

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Prometheus metrics
const collectDefaultMetrics = prometheus.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SRE Assignment API',
      version: '1.0.0',
      description: 'API Gateway for SRE assignment microservices',
      contact: {
        name: 'SRE Team',
        email: 'sre@example.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.round(config.rateLimitWindowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Basic middleware
app.use(compression());

// Body parsing - skip for image routes to allow streaming proxy
app.use((req, res, next) => {
  // Skip body parsing for image routes to allow raw streaming
  if (req.path.startsWith('/api/images')) {
    return next();
  }
  
  // Apply body parsing for other routes
  express.json({ limit: '10mb' })(req, res, () => {
    express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
  });
});

// Request logging
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.url}}',
  expressFormat: true,
  colorize: false,
  ignoreRoute: (req) => req.url === '/health' || req.url === '/metrics'
}));

// Metrics middleware
app.use(metrics.collectMetrics(httpRequestDuration, httpRequestTotal, activeConnections));

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint (no auth required)
app.use('/health', healthRoutes);

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheus.register.contentType);
    const metrics = await prometheus.register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
});

// Simple status endpoint (what frontend expects)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/images', imageRoutes); // Let image service handle auth
app.use('/api/chaos', authMiddleware, chaosRoutes);

// v1 API routes (proxy to existing routes)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', authMiddleware, userRoutes);
app.use('/api/v1/images', imageRoutes); // Let image service handle auth
app.use('/api/v1/chaos', authMiddleware, chaosRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SRE Assignment API Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      documentation: '/api-docs',
      auth: '/api/auth',
      users: '/api/users',
      images: '/api/images',
      chaos: '/api/chaos',
      'v1-auth': '/api/v1/auth',
      'v1-users': '/api/v1/users',
      'v1-images': '/api/v1/images',
      'v1-chaos': '/api/v1/chaos'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(expressWinston.errorLogger({
  winstonInstance: logger
}));

app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
const server = app.listen(config.port, () => {
  logger.info(`API Gateway listening on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`API Documentation: http://localhost:${config.port}/api-docs`);
  logger.info(`Health Check: http://localhost:${config.port}/health`);
  logger.info(`Metrics: http://localhost:${config.port}/metrics`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;