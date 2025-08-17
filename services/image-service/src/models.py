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
