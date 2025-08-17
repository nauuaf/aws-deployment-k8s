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
