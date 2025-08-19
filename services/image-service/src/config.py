import os
from pydantic import BaseModel
from typing import List
from urllib.parse import urlparse

class Settings(BaseModel):
    # Server settings
    port: int = int(os.getenv('PORT', '5000'))
    host: str = os.getenv('HOST', '0.0.0.0')
    environment: str = os.getenv('ENVIRONMENT', 'production')
    
    # AWS settings
    aws_region: str = os.getenv('AWS_REGION', 'eu-central-1')
    s3_bucket: str = os.getenv('S3_BUCKET_NAME', 'sre-assignment-poc-images')
    
    # Database settings (for metadata if needed)
    db_host: str = None
    db_port: int = None
    db_name: str = None
    db_user: str = None
    db_password: str = None
    database_url: str = os.getenv('DATABASE_URL', '')
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Parse DATABASE_URL if available
        if self.database_url:
            from urllib.parse import unquote
            parsed = urlparse(self.database_url)
            self.db_host = parsed.hostname or os.getenv('DB_HOST', 'localhost')
            self.db_port = parsed.port or int(os.getenv('DB_PORT', '5432'))
            self.db_name = parsed.path.lstrip('/') or os.getenv('DB_NAME', 'sre_assignment_poc')
            self.db_user = unquote(parsed.username) if parsed.username else os.getenv('DB_USER', 'postgres')
            self.db_password = unquote(parsed.password) if parsed.password else os.getenv('DB_PASSWORD', '')
        else:
            # Fall back to individual environment variables
            self.db_host = os.getenv('DB_HOST', 'localhost')
            self.db_port = int(os.getenv('DB_PORT', '5432'))
            self.db_name = os.getenv('DB_NAME', 'sre_assignment_poc')
            self.db_user = os.getenv('DB_USER', 'postgres')
            self.db_password = os.getenv('DB_PASSWORD', '')
    
    # Auth service settings
    auth_service_url: str = os.getenv('AUTH_SERVICE_URL', 'http://auth-service.backend.svc.cluster.local:8080/api/v1/auth')
    
    # Image processing settings
    max_file_size_mb: int = int(os.getenv('MAX_FILE_SIZE_MB', '10'))
    allowed_formats: List[str] = ['jpeg', 'jpg', 'png', 'gif', 'webp']
    
    # Logging
    log_level: str = os.getenv('LOG_LEVEL', 'info')

def get_settings() -> Settings:
    return Settings()
