import boto3
import uuid
import io
import asyncpg
from datetime import datetime
from src.config import get_settings
from typing import BinaryIO, Optional, Dict, Any, List
from PIL import Image
import structlog

logger = structlog.get_logger(__name__)

class ImageService:
    def __init__(self):
        self.settings = get_settings()
        # Initialize S3 client
        self.s3_client = boto3.client(
            's3',
            region_name=self.settings.aws_region
        )
        self.db_pool = None
    
    async def init_db_pool(self):
        """Initialize database connection pool"""
        if not self.db_pool:
            try:
                self.db_pool = await asyncpg.create_pool(
                    host=self.settings.db_host,
                    port=self.settings.db_port,
                    database=self.settings.db_name,
                    user=self.settings.db_user,
                    password=self.settings.db_password,
                    ssl='require',
                    min_size=1,
                    max_size=5
                )
                await self.create_images_table()
                logger.info("Database pool initialized successfully")
            except Exception as e:
                logger.error("Failed to initialize database pool", error=str(e))
                raise

    async def create_images_table(self):
        """Create images table if it doesn't exist"""
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS images (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            s3_key VARCHAR(500) NOT NULL UNIQUE,
            s3_bucket VARCHAR(100) NOT NULL,
            size BIGINT NOT NULL,
            content_type VARCHAR(100) NOT NULL,
            width INTEGER,
            height INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
        CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
        """
        
        async with self.db_pool.acquire() as conn:
            await conn.execute(create_table_sql)

    async def check_s3_connectivity(self):
        """Check S3 connectivity"""
        try:
            self.s3_client.head_bucket(Bucket=self.settings.s3_bucket)
            return True
        except Exception as e:
            logger.error("S3 connectivity check failed", error=str(e))
            return False
    
    async def upload_image(self, file: Any, user_id: str, generate_thumbnail: bool = True, quality: int = 85):
        """Upload image to S3 and store metadata in database"""
        if not self.db_pool:
            await self.init_db_pool()
            
        try:
            # Read file content
            content = await file.read()
            
            # Generate unique IDs
            image_id = str(uuid.uuid4())
            
            # Handle demo user case - generate a consistent UUID for demo users
            if user_id == "demo-user":
                # Use a consistent UUID for demo user
                user_uuid = uuid.UUID('00000000-0000-0000-0000-000000000001')
            else:
                try:
                    user_uuid = uuid.UUID(user_id)
                except ValueError:
                    # If user_id is not a valid UUID, generate one based on the string
                    user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
            
            original_filename = file.filename if hasattr(file, 'filename') else 'image.jpg'
            file_extension = original_filename.split('.')[-1].lower()
            filename = f"{image_id}.{file_extension}"
            s3_key = f"images/{str(user_uuid)}/{filename}"
            
            # Get image dimensions if it's an image
            width, height = None, None
            try:
                img = Image.open(io.BytesIO(content))
                width, height = img.size
            except Exception:
                logger.warning("Could not get image dimensions", filename=original_filename)
            
            # Upload to S3
            content_type = file.content_type if hasattr(file, 'content_type') else 'image/jpeg'
            
            self.s3_client.put_object(
                Bucket=self.settings.s3_bucket,
                Key=s3_key,
                Body=content,
                ContentType=content_type,
                Metadata={
                    'user_id': user_id,
                    'original_filename': original_filename,
                    'uploaded_at': datetime.now().isoformat()
                }
            )
            
            # Store metadata in database
            async with self.db_pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    INSERT INTO images (
                        id, user_id, filename, original_filename, s3_key, s3_bucket,
                        size, content_type, width, height
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                    ) RETURNING *
                    """,
                    uuid.UUID(image_id), user_uuid, filename, original_filename,
                    s3_key, self.settings.s3_bucket, len(content), content_type,
                    width, height
                )
            
            # Generate public S3 URL
            s3_url = f"https://{self.settings.s3_bucket}.s3.{self.settings.aws_region}.amazonaws.com/{s3_key}"
            
            return {
                'id': str(result['id']),
                'filename': result['original_filename'],
                'user_id': user_id,
                'size': result['size'],
                'url': s3_url,  # Direct S3 URL
                'thumbnail_url': None,  # TODO: Implement thumbnails later
                'created_at': result['created_at'].isoformat(),
                'content_type': result['content_type']
            }
            
        except Exception as e:
            logger.error("Upload failed", error=str(e), user_id=user_id)
            raise Exception(f"Upload failed: {str(e)}")
    
    async def get_user_images(self, user_id: str, page: int = 1, limit: int = 10, format_filter: Optional[str] = None):
        """Get user's images with pagination from database"""
        if not self.db_pool:
            await self.init_db_pool()
            
        try:
            # Calculate offset
            offset = (page - 1) * limit
            
            # Handle demo user case - use the same UUID logic as upload
            if user_id == "demo-user":
                user_uuid = uuid.UUID('00000000-0000-0000-0000-000000000001')
            else:
                try:
                    user_uuid = uuid.UUID(user_id)
                except ValueError:
                    user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
            
            # Build query with optional format filter
            where_clause = "WHERE user_id = $1"
            params = [user_uuid]
            
            if format_filter:
                where_clause += " AND content_type ILIKE $2"
                params.append(f"%{format_filter}%")
            
            async with self.db_pool.acquire() as conn:
                # Get total count
                count_query = f"SELECT COUNT(*) FROM images {where_clause}"
                total_count = await conn.fetchval(count_query, *params)
                
                # Get paginated results
                images_query = f"""
                    SELECT id, filename, original_filename, s3_key, s3_bucket, size, 
                           content_type, width, height, created_at
                    FROM images 
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
                """
                
                rows = await conn.fetch(images_query, *params, limit, offset)
                
                # Convert to response format
                images = []
                for row in rows:
                    s3_url = f"https://{row['s3_bucket']}.s3.{self.settings.aws_region}.amazonaws.com/{row['s3_key']}"
                    images.append({
                        'id': str(row['id']),
                        'filename': row['original_filename'],
                        'user_id': user_id,
                        'size': row['size'],
                        'url': s3_url,
                        'thumbnail_url': None,
                        'created_at': row['created_at'].isoformat(),
                        'content_type': row['content_type']
                    })
                
                return {
                    'images': images,
                    'pagination': {
                        'currentPage': page,
                        'totalPages': (total_count + limit - 1) // limit,
                        'totalImages': total_count,
                        'hasNextPage': (page * limit) < total_count,
                        'hasPreviousPage': page > 1
                    }
                }
                
        except Exception as e:
            logger.error("Failed to get images", error=str(e), user_id=user_id)
            raise Exception(f"Failed to get images: {str(e)}")
    
    async def get_image_by_id(self, image_id: str, user_id: str):
        """Get specific image by ID with user validation"""
        if not self.db_pool:
            await self.init_db_pool()
            
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, filename, original_filename, s3_key, s3_bucket, size, 
                           content_type, width, height, created_at
                    FROM images 
                    WHERE id = $1 AND user_id = $2
                    """,
                    uuid.UUID(image_id), uuid.UUID(user_id)
                )
                
                if row:
                    s3_url = f"https://{row['s3_bucket']}.s3.{self.settings.aws_region}.amazonaws.com/{row['s3_key']}"
                    return {
                        'id': str(row['id']),
                        'filename': row['original_filename'],
                        'user_id': user_id,
                        'size': row['size'],
                        'url': s3_url,
                        'thumbnail_url': None,
                        'created_at': row['created_at'].isoformat(),
                        'content_type': row['content_type']
                    }
                return None
        except Exception as e:
            logger.error("Failed to get image by ID", error=str(e), image_id=image_id)
            return None
    
    async def get_image_by_id_public(self, image_id: str):
        """Get image metadata for public viewing (no user restriction)"""
        if not self.db_pool:
            await self.init_db_pool()
            
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, filename, original_filename, s3_key, s3_bucket, size, 
                           content_type, width, height, created_at, user_id
                    FROM images 
                    WHERE id = $1
                    """,
                    uuid.UUID(image_id)
                )
                
                if row:
                    s3_url = f"https://{row['s3_bucket']}.s3.{self.settings.aws_region}.amazonaws.com/{row['s3_key']}"
                    return {
                        'id': str(row['id']),
                        'filename': row['original_filename'],
                        'user_id': str(row['user_id']),
                        'size': row['size'],
                        'url': s3_url,
                        'thumbnail_url': None,
                        'created_at': row['created_at'].isoformat(),
                        'content_type': row['content_type']
                    }
                return None
        except Exception as e:
            logger.error("Failed to get image by ID (public)", error=str(e), image_id=image_id)
            return None
    
    async def delete_image(self, image_id: str, user_id: str):
        """Delete image from S3 and database"""
        if not self.db_pool:
            await self.init_db_pool()
            
        try:
            async with self.db_pool.acquire() as conn:
                # First, get the image info to delete from S3
                row = await conn.fetchrow(
                    """
                    SELECT s3_key, s3_bucket FROM images 
                    WHERE id = $1 AND user_id = $2
                    """,
                    uuid.UUID(image_id), uuid.UUID(user_id)
                )
                
                if not row:
                    return False
                
                # Delete from S3
                try:
                    self.s3_client.delete_object(
                        Bucket=row['s3_bucket'],
                        Key=row['s3_key']
                    )
                except Exception as e:
                    logger.warning("Failed to delete from S3", error=str(e), s3_key=row['s3_key'])
                
                # Delete from database
                deleted_rows = await conn.execute(
                    "DELETE FROM images WHERE id = $1 AND user_id = $2",
                    uuid.UUID(image_id), uuid.UUID(user_id)
                )
                
                return deleted_rows == "DELETE 1"
                
        except Exception as e:
            logger.error("Failed to delete image", error=str(e), image_id=image_id)
            return False
    
    async def process_image(self, image_id: str, user_id: str, operations: List[Dict], output_format: str = 'jpeg', quality: int = 85):
        """Process image with operations (mock implementation)"""
        image = self.mock_storage.get(image_id)
        if image and image['user_id'] == user_id:
            # Mock processing
            processed_id = str(uuid.uuid4())
            processed_image = {
                **image,
                'id': processed_id,
                'original_id': image_id,
                'operations': operations,
                'processed_at': datetime.now().isoformat()
            }
            self.mock_storage[processed_id] = processed_image
            return processed_image
        return None
