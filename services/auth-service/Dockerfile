# Multi-stage build for Auth service (Go)

# Build stage
FROM golang:1.21-alpine AS builder

# Install git and ca-certificates (needed for go mod download)
RUN apk update && apk add --no-cache git ca-certificates tzdata && update-ca-certificates

# Set working directory
WORKDIR /app

# Copy go mod files and source code
COPY go.mod ./
COPY . .

# Download dependencies and tidy (needs source files for proper checksums)
RUN go mod download && go mod tidy

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o auth-service .

# Production stage - using alpine for security
FROM alpine:3.18

# Install ca-certificates and timezone data
RUN apk --no-cache add ca-certificates tzdata && update-ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# Set working directory
WORKDIR /app

# Copy the binary
COPY --from=builder --chown=appuser:appuser /app/auth-service /app/auth-service

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/app/auth-service", "healthcheck"] || exit 1

# Run the application
ENTRYPOINT ["/app/auth-service"]