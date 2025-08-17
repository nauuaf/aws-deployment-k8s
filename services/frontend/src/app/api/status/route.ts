import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // This endpoint proxies to the actual backend API service health check
    // Since the ingress routes /api (except specific paths) to api-service,
    // we can call the backend health endpoint directly
    const backendHealthUrl = 'http://api-service.frontend.svc.cluster.local:3000/health';
    
    const response = await fetch(backendHealthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout for health checks
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: 'Backend API service is not responding',
          statusCode: response.status,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    const healthData = await response.json();
    
    return NextResponse.json({
      ...healthData,
      proxied: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Backend health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'api-service',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}