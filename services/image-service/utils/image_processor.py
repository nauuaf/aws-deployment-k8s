import io
import os
from typing import Tuple, Optional, Dict, Any
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import boto3
from botocore.exceptions import ClientError
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class ImageProcessor:
    """Image processing utilities for the image service."""
    
    def __init__(self):
        self.s3_client = None
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'sre-assignment-images')
        
        # Initialize S3 client if AWS credentials are available
        try:
            self.s3_client = boto3.client('s3')
            logger.info("S3 client initialized successfully")
        except Exception as e:
            logger.warning(f"Could not initialize S3 client: {e}")
    
    def validate_image(self, image_data: bytes) -> Dict[str, Any]:
        """
        Validate image data and return metadata.
        
        Args:
            image_data: Raw image bytes
            
        Returns:
            Dict containing validation result and metadata
        """
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                # Check if it's a valid image
                img.verify()
                
                # Get metadata
                img = Image.open(io.BytesIO(image_data))  # Re-open after verify
                width, height = img.size
                format_name = img.format
                mode = img.mode
                
                # Calculate file size
                file_size = len(image_data)
                
                # Check file size (max 10MB)
                max_size = 10 * 1024 * 1024  # 10MB
                if file_size > max_size:
                    return {
                        'valid': False,
                        'error': f'File size too large: {file_size} bytes (max: {max_size} bytes)'
                    }
                
                # Check dimensions (max 4K resolution)
                max_dimension = 4096
                if width > max_dimension or height > max_dimension:
                    return {
                        'valid': False,
                        'error': f'Image dimensions too large: {width}x{height} (max: {max_dimension}x{max_dimension})'
                    }
                
                return {
                    'valid': True,
                    'metadata': {
                        'width': width,
                        'height': height,
                        'format': format_name,
                        'mode': mode,
                        'file_size': file_size,
                        'aspect_ratio': round(width / height, 2) if height > 0 else 0
                    }
                }
                
        except Exception as e:
            logger.error(f"Image validation failed: {e}")
            return {
                'valid': False,
                'error': f'Invalid image format: {str(e)}'
            }
    
    def resize_image(self, image_data: bytes, width: int, height: int, 
                    maintain_aspect: bool = True) -> bytes:
        """
        Resize image to specified dimensions.
        
        Args:
            image_data: Raw image bytes
            width: Target width
            height: Target height
            maintain_aspect: Whether to maintain aspect ratio
            
        Returns:
            Resized image bytes
        """
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                if maintain_aspect:
                    img.thumbnail((width, height), Image.Resampling.LANCZOS)
                else:
                    img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                # Save to bytes
                output = io.BytesIO()
                format_name = img.format or 'JPEG'
                
                # Convert RGBA to RGB for JPEG
                if format_name == 'JPEG' and img.mode in ('RGBA', 'LA', 'P'):
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = rgb_img
                
                img.save(output, format=format_name, quality=85, optimize=True)
                return output.getvalue()
                
        except Exception as e:
            logger.error(f"Image resize failed: {e}")
            raise ValueError(f"Failed to resize image: {str(e)}")
    
    def create_thumbnail(self, image_data: bytes, size: int = 200) -> bytes:
        """
        Create a thumbnail of the image.
        
        Args:
            image_data: Raw image bytes
            size: Thumbnail size (square)
            
        Returns:
            Thumbnail image bytes
        """
        return self.resize_image(image_data, size, size, maintain_aspect=True)
    
    def apply_filter(self, image_data: bytes, filter_name: str) -> bytes:
        """
        Apply a filter to the image.
        
        Args:
            image_data: Raw image bytes
            filter_name: Name of the filter to apply
            
        Returns:
            Filtered image bytes
        """
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                # Apply filter based on name
                if filter_name.lower() == 'blur':
                    img = img.filter(ImageFilter.GaussianBlur(radius=2))
                elif filter_name.lower() == 'sharpen':
                    img = img.filter(ImageFilter.SHARPEN)
                elif filter_name.lower() == 'edge':
                    img = img.filter(ImageFilter.FIND_EDGES)
                elif filter_name.lower() == 'emboss':
                    img = img.filter(ImageFilter.EMBOSS)
                elif filter_name.lower() == 'grayscale':
                    img = ImageOps.grayscale(img)
                elif filter_name.lower() == 'sepia':
                    img = ImageOps.grayscale(img)
                    img = ImageOps.colorize(img, '#704214', '#C0A882')
                elif filter_name.lower() == 'enhance':
                    enhancer = ImageEnhance.Color(img)
                    img = enhancer.enhance(1.3)
                    enhancer = ImageEnhance.Contrast(img)
                    img = enhancer.enhance(1.1)
                else:
                    raise ValueError(f"Unknown filter: {filter_name}")
                
                # Save to bytes
                output = io.BytesIO()
                format_name = img.format or 'JPEG'
                
                # Convert RGBA to RGB for JPEG
                if format_name == 'JPEG' and img.mode in ('RGBA', 'LA', 'P'):
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = rgb_img
                
                img.save(output, format=format_name, quality=85, optimize=True)
                return output.getvalue()
                
        except Exception as e:
            logger.error(f"Filter application failed: {e}")
            raise ValueError(f"Failed to apply filter: {str(e)}")
    
    def rotate_image(self, image_data: bytes, angle: float) -> bytes:
        """
        Rotate image by specified angle.
        
        Args:
            image_data: Raw image bytes
            angle: Rotation angle in degrees
            
        Returns:
            Rotated image bytes
        """
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                img = img.rotate(angle, expand=True, fillcolor='white')
                
                # Save to bytes
                output = io.BytesIO()
                format_name = img.format or 'JPEG'
                
                # Convert RGBA to RGB for JPEG
                if format_name == 'JPEG' and img.mode in ('RGBA', 'LA', 'P'):
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = rgb_img
                
                img.save(output, format=format_name, quality=85, optimize=True)
                return output.getvalue()
                
        except Exception as e:
            logger.error(f"Image rotation failed: {e}")
            raise ValueError(f"Failed to rotate image: {str(e)}")
    
    async def upload_to_s3(self, image_data: bytes, key: str, content_type: str) -> Dict[str, Any]:
        """
        Upload image to S3.
        
        Args:
            image_data: Raw image bytes
            key: S3 object key
            content_type: MIME type
            
        Returns:
            Upload result dict
        """
        if not self.s3_client:
            raise ValueError("S3 client not available")
        
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=image_data,
                ContentType=content_type,
                Metadata={
                    'uploaded_at': datetime.utcnow().isoformat(),
                    'file_size': str(len(image_data))
                }
            )
            
            return {
                'success': True,
                'url': f'https://{self.bucket_name}.s3.amazonaws.com/{key}',
                'key': key,
                'size': len(image_data)
            }
            
        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            return {
                'success': False,
                'error': f'S3 upload failed: {str(e)}'
            }
    
    async def download_from_s3(self, key: str) -> Optional[bytes]:
        """
        Download image from S3.
        
        Args:
            key: S3 object key
            
        Returns:
            Image bytes or None if failed
        """
        if not self.s3_client:
            raise ValueError("S3 client not available")
        
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            return response['Body'].read()
            
        except ClientError as e:
            logger.error(f"S3 download failed: {e}")
            return None
    
    def get_available_filters(self) -> Dict[str, str]:
        """
        Get list of available image filters.
        
        Returns:
            Dict of filter names and descriptions
        """
        return {
            'blur': 'Apply Gaussian blur effect',
            'sharpen': 'Enhance image sharpness',
            'edge': 'Detect edges in the image',
            'emboss': 'Apply emboss effect',
            'grayscale': 'Convert to grayscale',
            'sepia': 'Apply sepia tone effect',
            'enhance': 'Enhance color and contrast'
        }
    
    def get_image_info(self, image_data: bytes) -> Dict[str, Any]:
        """
        Get detailed information about an image.
        
        Args:
            image_data: Raw image bytes
            
        Returns:
            Image information dict
        """
        validation = self.validate_image(image_data)
        if not validation['valid']:
            return validation
        
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                info = validation['metadata'].copy()
                
                # Add additional information
                if hasattr(img, '_getexif') and img._getexif():
                    info['has_exif'] = True
                else:
                    info['has_exif'] = False
                
                # Color analysis
                if img.mode == 'RGBA' or img.mode == 'LA':
                    info['has_transparency'] = True
                else:
                    info['has_transparency'] = False
                
                # Estimated compression ratio (rough estimate)
                uncompressed_size = info['width'] * info['height'] * 3  # RGB
                compression_ratio = round(uncompressed_size / info['file_size'], 2)
                info['compression_ratio'] = compression_ratio
                
                return {
                    'valid': True,
                    'info': info
                }
                
        except Exception as e:
            logger.error(f"Failed to get image info: {e}")
            return {
                'valid': False,
                'error': f'Failed to analyze image: {str(e)}'
            }