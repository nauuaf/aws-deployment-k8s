#!/bin/bash

# This script ensures the image-service has all required source modules
# It creates the minimal implementation needed for the service to start

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Setting up image-service source modules..."

# Create src directory structure
mkdir -p "$SCRIPT_DIR/src/services" "$SCRIPT_DIR/src/middleware"

# Create __init__.py files
echo "# Image service package" > "$SCRIPT_DIR/src/__init__.py"
echo "# Services package" > "$SCRIPT_DIR/src/services/__init__.py"
echo "# Middleware package" > "$SCRIPT_DIR/src/middleware/__init__.py"

# Create config.py
cat > "$SCRIPT_DIR/src/config.py" << 'EOF'
import os
from pydantic import BaseModel
from typing import List

class Settings(BaseModel):
    # Server settings
    port: int = int(os.getenv('PORT', '5000'))
    host: str = os.getenv('HOST', '0.0.0.0')
    environment: str = os.getenv('ENVIRONMENT', 'production')
    
    # AWS settings
    aws_region: str = os.getenv('AWS_REGION', 'eu-central-1')
    s3_bucket: str = os.getenv('S3_BUCKET', 'sre-assignment-poc-images')
    
    # Database settings (for metadata if needed)
    db_host: str = os.getenv('DB_HOST', 'localhost')
    db_port: int = int(os.getenv('DB_PORT', '5432'))
    db_name: str = os.getenv('DB_NAME', 'sre_assignment_poc')
    db_user: str = os.getenv('DB_USER', 'postgres')
    db_password: str = os.getenv('DB_PASSWORD', '')
    
    # Auth service settings
    auth_service_url: str = os.getenv('AUTH_SERVICE_URL', 'http://sre-assignment-poc-auth:8080')
    
    # Image processing settings
    max_file_size_mb: int = int(os.getenv('MAX_FILE_SIZE_MB', '10'))
    allowed_formats: List[str] = ['jpeg', 'jpg', 'png', 'gif', 'webp']
    
    # Logging
    log_level: str = os.getenv('LOG_LEVEL', 'info')

def get_settings() -> Settings:
    return Settings()
EOF

# Create database.py
cat > "$SCRIPT_DIR/src/database.py" << 'EOF'
import asyncio
import asyncpg
from src.config import get_settings

async def init_db():
    """Initialize database connection (minimal implementation)"""
    settings = get_settings()
    try:
        # For now, just test connection
        conn = await asyncpg.connect(
            host=settings.db_host,
            port=settings.db_port,
            database=settings.db_name,
            user=settings.db_user,
            password=settings.db_password
        )
        await conn.close()
        print("Database connection successful")
    except Exception as e:
        print(f"Database connection failed: {e}")

async def close_db():
    """Close database connections"""
    pass
EOF

# Create models.py
cat > "$SCRIPT_DIR/src/models.py" << 'EOF'
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ImageMetadata(BaseModel):
    filename: str
    size: int
    content_type: str
    s3_key: str
    created_at: datetime
    
class HealthCheck(BaseModel):
    status: str = "healthy"
    timestamp: datetime
    service: str = "image-service"
    
class ImageProcessRequest(BaseModel):
    operation: str
    parameters: Optional[dict] = None
EOF

# Create image_service.py
cat > "$SCRIPT_DIR/src/services/image_service.py" << 'EOF'
import boto3
import uuid
from src.config import get_settings
from typing import BinaryIO

class ImageService:
    def __init__(self):
        self.settings = get_settings()
        self.s3_client = boto3.client('s3', region_name=self.settings.aws_region)
    
    async def upload_image(self, file: BinaryIO, filename: str, content_type: str):
        """Upload image to S3"""
        try:
            # Generate unique key
            file_extension = filename.split('.')[-1]
            s3_key = f"uploads/{uuid.uuid4()}.{file_extension}"
            
            # Upload to S3
            self.s3_client.upload_fileobj(
                file,
                self.settings.s3_bucket,
                s3_key,
                ExtraArgs={'ContentType': content_type}
            )
            
            return {
                'success': True,
                's3_key': s3_key,
                'filename': filename,
                'bucket': self.settings.s3_bucket
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def delete_image(self, s3_key: str):
        """Delete image from S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.settings.s3_bucket,
                Key=s3_key
            )
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
EOF

# Create auth_service.py
cat > "$SCRIPT_DIR/src/services/auth_service.py" << 'EOF'
import httpx
from src.config import get_settings

class AuthService:
    def __init__(self):
        self.settings = get_settings()
        self.auth_url = self.settings.auth_service_url
    
    async def verify_token(self, token: str):
        """Verify JWT token with auth service"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.auth_url}/verify",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5.0
                )
                return response.status_code == 200
        except Exception as e:
            print(f"Auth verification failed: {e}")
            return False
EOF

# Create metrics.py middleware
cat > "$SCRIPT_DIR/src/middleware/metrics.py" << 'EOF'
from fastapi import Request
from prometheus_client import Counter, Histogram
from starlette.middleware.base import BaseHTTPMiddleware
import time

# Metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration', ['method', 'endpoint'])

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Record metrics
        duration = time.time() - start_time
        method = request.method
        path = request.url.path
        status = response.status_code
        
        REQUEST_COUNT.labels(method=method, endpoint=path, status=status).inc()
        REQUEST_DURATION.labels(method=method, endpoint=path).observe(duration)
        
        return response
EOF

# Create logging.py middleware
cat > "$SCRIPT_DIR/src/middleware/logging.py" << 'EOF'
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
import time

logger = structlog.get_logger()

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Log request
        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host if request.client else None
        )
        
        # Process request
        response = await call_next(request)
        
        # Log response
        duration = time.time() - start_time
        logger.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            duration=duration,
            status=response.status_code
        )
        
        return response
EOF

echo "Image service source modules created successfully!"
echo "Location: $SCRIPT_DIR/src/"
ls -la "$SCRIPT_DIR/src/"