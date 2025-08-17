const express = require('express');
const axios = require('axios');
const { StatusCodes } = require('http-status-codes');
const { Pool } = require('pg');

const router = express.Router();

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'sredb',
  user: process.env.DB_USER || 'sreuser',
  password: process.env.DB_PASSWORD || 'password',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Service URLs
const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:8080';
const imageServiceUrl = process.env.IMAGE_SERVICE_URL || 'http://image-service:5000';

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Returns the basic health status of the API service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get('/', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    service: 'api-service',
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(StatusCodes.OK).json(healthCheck);
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     description: Checks if the service is ready to accept traffic (all dependencies are available)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req, res) => {
  const checks = {
    database: false,
    authService: false,
    imageService: false
  };

  const results = [];

  try {
    // Check database connectivity
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      checks.database = true;
      results.push({ name: 'database', status: 'healthy', latency: 0 });
    } catch (dbError) {
      results.push({ 
        name: 'database', 
        status: 'unhealthy', 
        error: dbError.message,
        latency: 0
      });
    }

    // Check auth service
    try {
      const authStart = Date.now();
      await axios.get(`${authServiceUrl}/health`, { timeout: 3000 });
      const authLatency = Date.now() - authStart;
      checks.authService = true;
      results.push({ name: 'auth-service', status: 'healthy', latency: authLatency });
    } catch (authError) {
      results.push({ 
        name: 'auth-service', 
        status: 'unhealthy', 
        error: authError.message,
        latency: 0
      });
    }

    // Check image service
    try {
      const imageStart = Date.now();
      await axios.get(`${imageServiceUrl}/health`, { timeout: 3000 });
      const imageLatency = Date.now() - imageStart;
      checks.imageService = true;
      results.push({ name: 'image-service', status: 'healthy', latency: imageLatency });
    } catch (imageError) {
      results.push({ 
        name: 'image-service', 
        status: 'unhealthy', 
        error: imageError.message,
        latency: 0
      });
    }

    const allHealthy = Object.values(checks).every(check => check === true);
    const status = allHealthy ? 'ready' : 'not_ready';
    const statusCode = allHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      checks: results,
      overall: {
        healthy: results.filter(r => r.status === 'healthy').length,
        unhealthy: results.filter(r => r.status === 'unhealthy').length,
        total: results.length
      }
    });

  } catch (error) {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message,
      checks: results
    });
  }
});

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness check
 *     description: Checks if the service is alive (basic functionality test)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 *       503:
 *         description: Service is not responding properly
 */
router.get('/live', async (req, res) => {
  try {
    // Basic liveness checks
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Check if memory usage is reasonable (less than 1GB)
    const memoryLimitBytes = 1024 * 1024 * 1024; // 1GB
    const memoryHealthy = memoryUsage.heapUsed < memoryLimitBytes;

    // Check if we can perform basic operations
    const canProcessRequests = typeof JSON.stringify === 'function' && 
                              typeof Date.now === 'function';

    const isAlive = memoryHealthy && canProcessRequests;

    const response = {
      status: isAlive ? 'alive' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        healthy: memoryHealthy
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };

    const statusCode = isAlive ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(response);

  } catch (error) {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Comprehensive health check including all dependencies and system metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health information
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const checks = [];
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    // Database check with detailed info
    try {
      const dbStart = Date.now();
      const client = await pool.connect();
      const result = await client.query('SELECT version(), now() as current_time');
      client.release();
      
      checks.push({
        name: 'database',
        status: 'healthy',
        latency: Date.now() - dbStart,
        details: {
          version: result.rows[0].version,
          currentTime: result.rows[0].current_time,
          poolSize: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        }
      });
    } catch (dbError) {
      checks.push({
        name: 'database',
        status: 'unhealthy',
        error: dbError.message,
        latency: 0
      });
    }

    // External services check
    const externalServices = [
      { name: 'auth-service', url: authServiceUrl },
      { name: 'image-service', url: imageServiceUrl }
    ];

    for (const service of externalServices) {
      try {
        const serviceStart = Date.now();
        const response = await axios.get(`${service.url}/health`, { 
          timeout: 5000,
          validateStatus: () => true // Accept any status code
        });
        
        checks.push({
          name: service.name,
          status: response.status < 400 ? 'healthy' : 'unhealthy',
          latency: Date.now() - serviceStart,
          details: {
            statusCode: response.status,
            responseTime: Date.now() - serviceStart,
            url: service.url
          }
        });
      } catch (serviceError) {
        checks.push({
          name: service.name,
          status: 'unhealthy',
          error: serviceError.message,
          latency: 0,
          details: {
            url: service.url,
            errorCode: serviceError.code
          }
        });
      }
    }

    const healthyCount = checks.filter(check => check.status === 'healthy').length;
    const totalChecks = checks.length;
    const overallHealthy = healthyCount === totalChecks;

    const response = {
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      system: systemInfo,
      checks,
      summary: {
        healthy: healthyCount,
        unhealthy: totalChecks - healthyCount,
        total: totalChecks,
        healthPercentage: Math.round((healthyCount / totalChecks) * 100)
      }
    };

    const statusCode = overallHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(response);

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
});

module.exports = router;