'use client';

import { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

export default function AuthenticatedImage({ 
  src, 
  alt, 
  className = '', 
  fallback 
}: AuthenticatedImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(false);

        // Check if the URL is a direct S3 URL or HTTPS URL
        if (src.startsWith('https://') || src.startsWith('http://')) {
          // Direct URL (likely S3) - use it directly
          setImageUrl(src);
          return;
        }

        // Otherwise, it's an API endpoint that needs authentication
        const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
        
        // If the src doesn't start with /api, add it
        const apiSrc = src.startsWith('/api') ? src : `/api${src}`;
        
        const response = await fetch(apiSrc, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        console.error('Failed to load image:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();

    // Cleanup blob URL on unmount
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="animate-pulse">
          <ImageIcon className="h-6 w-6 text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return fallback || (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <ImageIcon className="h-6 w-6 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}