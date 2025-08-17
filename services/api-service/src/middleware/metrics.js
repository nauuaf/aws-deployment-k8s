const prometheus = require('prom-client');

/**
 * Middleware to collect HTTP metrics for Prometheus
 */
const collectMetrics = (httpRequestDuration, httpRequestTotal, activeConnections) => {
  return (req, res, next) => {
    const start = Date.now();
    
    // Increment active connections
    activeConnections.inc();

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = (Date.now() - start) / 1000;
      const route = req.route ? req.route.path : req.path;
      const method = req.method;
      const statusCode = res.statusCode.toString();

      // Record metrics
      httpRequestDuration
        .labels(method, route, statusCode)
        .observe(duration);

      httpRequestTotal
        .labels(method, route, statusCode)
        .inc();

      // Decrement active connections
      activeConnections.dec();

      // Call original end function
      originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Create custom metrics for business logic
 */
const createCustomMetrics = () => {
  const authAttempts = new prometheus.Counter({
    name: 'auth_attempts_total',
    help: 'Total number of authentication attempts',
    labelNames: ['status', 'method']
  });

  const imageUploads = new prometheus.Counter({
    name: 'image_uploads_total',
    help: 'Total number of image uploads',
    labelNames: ['status', 'format']
  });

  const imageProcessingDuration = new prometheus.Histogram({
    name: 'image_processing_duration_seconds',
    help: 'Duration of image processing operations',
    labelNames: ['operation', 'format'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  });

  const databaseQueries = new prometheus.Counter({
    name: 'database_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'table', 'status']
  });

  const databaseQueryDuration = new prometheus.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });

  const externalServiceCalls = new prometheus.Counter({
    name: 'external_service_calls_total',
    help: 'Total number of external service calls',
    labelNames: ['service', 'method', 'status']
  });

  const externalServiceDuration = new prometheus.Histogram({
    name: 'external_service_duration_seconds',
    help: 'Duration of external service calls',
    labelNames: ['service', 'method'],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10]
  });

  return {
    authAttempts,
    imageUploads,
    imageProcessingDuration,
    databaseQueries,
    databaseQueryDuration,
    externalServiceCalls,
    externalServiceDuration
  };
};

/**
 * Middleware to track API endpoint usage
 */
const trackEndpointUsage = () => {
  const endpointUsage = new prometheus.Counter({
    name: 'api_endpoint_usage_total',
    help: 'Total usage of API endpoints',
    labelNames: ['endpoint', 'method', 'user_role']
  });

  return (req, res, next) => {
    const originalEnd = res.end;
    res.end = function(...args) {
      const endpoint = req.route ? req.route.path : 'unknown';
      const method = req.method;
      const userRole = req.user ? req.user.role : 'anonymous';

      endpointUsage
        .labels(endpoint, method, userRole)
        .inc();

      originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Error rate tracking middleware
 */
const trackErrorRates = () => {
  const errorRate = new prometheus.Counter({
    name: 'api_errors_total',
    help: 'Total number of API errors',
    labelNames: ['endpoint', 'method', 'error_type', 'status_code']
  });

  return (req, res, next) => {
    const originalEnd = res.end;
    res.end = function(...args) {
      if (res.statusCode >= 400) {
        const endpoint = req.route ? req.route.path : 'unknown';
        const method = req.method;
        const statusCode = res.statusCode.toString();
        
        let errorType = 'unknown';
        if (res.statusCode >= 400 && res.statusCode < 500) {
          errorType = 'client_error';
        } else if (res.statusCode >= 500) {
          errorType = 'server_error';
        }

        errorRate
          .labels(endpoint, method, errorType, statusCode)
          .inc();
      }

      originalEnd.apply(this, args);
    };

    next();
  };
};

module.exports = {
  collectMetrics,
  createCustomMetrics,
  trackEndpointUsage,
  trackErrorRates
};