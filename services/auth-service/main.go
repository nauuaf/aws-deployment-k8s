package main

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"

	"auth-service/internal/config"
	"auth-service/internal/database"
	"auth-service/internal/handlers"
	"auth-service/internal/middleware"
	"auth-service/internal/repository"
	"auth-service/internal/service"
)

var (
	// Prometheus metrics
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint"},
	)

	authAttempts = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_attempts_total",
			Help: "Total number of authentication attempts",
		},
		[]string{"status", "method"},
	)

	tokenOperations = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "token_operations_total",
			Help: "Total number of token operations",
		},
		[]string{"operation", "status"},
	)

	databaseConnections = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "database_connections",
			Help: "Number of database connections",
		},
		[]string{"state"},
	)
)

func init() {
	// Register Prometheus metrics
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
	prometheus.MustRegister(authAttempts)
	prometheus.MustRegister(tokenOperations)
	prometheus.MustRegister(databaseConnections)
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		logrus.Info("No .env file found, using environment variables")
	}

	// Initialize configuration
	cfg := config.Load()

	// Setup logging
	setupLogging(cfg)

	// Initialize database
	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		logrus.WithError(err).Fatal("Failed to initialize database")
	}
	defer db.Close()

	// Run database migrations
	if err := database.Migrate(db); err != nil {
		logrus.WithError(err).Fatal("Failed to run database migrations")
	}

	// Initialize dependencies
	userRepo := repository.NewUserRepository(db)
	authService := service.NewAuthService(userRepo)
	authHandler := handlers.NewAuthHandler(authService)

	// Setup Gin router
	if cfg.Environment == "production" || cfg.Environment == "poc" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Add middleware
	router.Use(middleware.Logger())
	router.Use(middleware.Recovery())
	router.Use(middleware.CORS())
	router.Use(middleware.Metrics(httpRequestsTotal, httpRequestDuration))

	// Health check endpoints
	router.GET("/health", healthCheck(db))
	router.GET("/health/ready", readinessCheck(db))
	router.GET("/health/live", livenessCheck())

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Simple auth health endpoint (what frontend expects)
		v1.GET("/auth/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":    "healthy",
				"service":   "auth-service",
				"timestamp": time.Now().UTC(),
			})
		})
		
		v1.POST("/register", authHandler.Register)
		v1.POST("/login", authHandler.Login)
		v1.POST("/refresh", authHandler.RefreshToken)
		v1.POST("/verify", authHandler.VerifyToken)
		v1.POST("/logout", authHandler.Logout)
		v1.POST("/forgot-password", authHandler.ForgotPassword)
		v1.POST("/reset-password", authHandler.ResetPassword)
	}

	// Backwards compatibility routes (no /api/v1 prefix)
	router.POST("/register", authHandler.Register)
	router.POST("/login", authHandler.Login)
	router.POST("/refresh", authHandler.RefreshToken)
	router.POST("/verify", authHandler.VerifyToken)
	router.POST("/logout", authHandler.Logout)
	router.POST("/forgot-password", authHandler.ForgotPassword)
	router.POST("/reset-password", authHandler.ResetPassword)

	// Start database metrics collection
	go collectDatabaseMetrics(db)

	// Setup server
	srv := &http.Server{
		Addr:         ":" + strconv.Itoa(cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		logrus.WithFields(logrus.Fields{
			"port":        cfg.Port,
			"environment": cfg.Environment,
		}).Info("Starting auth service")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logrus.WithError(err).Fatal("Failed to start server")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logrus.Info("Shutting down server...")

	// Give outstanding requests a deadline for completion
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logrus.WithError(err).Fatal("Server forced to shutdown")
	}

	logrus.Info("Server exited")
}

func setupLogging(cfg *config.Config) {
	level, err := logrus.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = logrus.InfoLevel
	}

	logrus.SetLevel(level)
	logrus.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: time.RFC3339,
	})

	if cfg.Environment == "development" {
		logrus.SetFormatter(&logrus.TextFormatter{
			FullTimestamp: true,
		})
	}
}

func healthCheck(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().UTC(),
			"service":   "auth-service",
			"version":   "1.0.0",
		})
	}
}

func readinessCheck(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		checks := make(map[string]interface{})

		// Check database connectivity
		if err := db.Ping(); err != nil {
			checks["database"] = map[string]interface{}{
				"status": "unhealthy",
				"error":  err.Error(),
			}
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":    "not_ready",
				"timestamp": time.Now().UTC(),
				"checks":    checks,
			})
			return
		}

		checks["database"] = map[string]interface{}{
			"status": "healthy",
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"timestamp": time.Now().UTC(),
			"checks":    checks,
		})
	}
}

func livenessCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "alive",
			"timestamp": time.Now().UTC(),
		})
	}
}

func collectDatabaseMetrics(db *sql.DB) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		stats := db.Stats()
		databaseConnections.WithLabelValues("open").Set(float64(stats.OpenConnections))
		databaseConnections.WithLabelValues("idle").Set(float64(stats.Idle))
		databaseConnections.WithLabelValues("in_use").Set(float64(stats.InUse))
	}
}