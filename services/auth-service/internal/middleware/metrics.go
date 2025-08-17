package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

// Metrics returns a middleware that collects HTTP metrics for Prometheus
func Metrics(requestsTotal *prometheus.CounterVec, requestDuration *prometheus.HistogramVec) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Collect metrics
		status := strconv.Itoa(c.Writer.Status())
		endpoint := c.FullPath()
		method := c.Request.Method
		
		// If no route was matched, use the path
		if endpoint == "" {
			endpoint = c.Request.URL.Path
		}

		// Record the request
		requestsTotal.WithLabelValues(method, endpoint, status).Inc()
		
		// Record the duration
		duration := time.Since(start)
		requestDuration.WithLabelValues(method, endpoint).Observe(duration.Seconds())
	}
}