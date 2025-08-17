package config

import (
	"net/url"
	"os"
	"strconv"
)

type Config struct {
	Port        int
	Environment string
	LogLevel    string
	DatabaseURL string
	JWTSecret   string
	TokenExpiry int // in hours
}

func Load() *Config {
	config := &Config{
		Port:        getEnvAsInt("PORT", 8080),
		Environment: getEnv("NODE_ENV", "production"),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
		DatabaseURL: buildDatabaseURL(),
		JWTSecret:   getEnv("JWT_SECRET", "your-jwt-secret-key"),
		TokenExpiry: getEnvAsInt("TOKEN_EXPIRY", 24),
	}

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func buildDatabaseURL() string {
	// Check for DATABASE_URL first (common in cloud deployments)
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		return dbURL
	}

	// Build from individual components
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "sreuser")
	password := getEnv("DB_PASSWORD", "password")
	dbname := getEnv("DB_NAME", "sredb")
	sslmode := getEnv("DB_SSLMODE", "disable")

	return "postgres://" + url.QueryEscape(user) + ":" + url.QueryEscape(password) + "@" + host + ":" + port + "/" + dbname + "?sslmode=" + sslmode
}