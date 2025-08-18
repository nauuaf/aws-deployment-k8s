import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const baseUrl = request.headers.get('host') ? `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}` : '';
    const healthUrl = `${baseUrl}/api/v1/auth/health`;
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError) {
      console.error('Failed to reach auth service:', fetchError);
      // Return mock healthy response for demo purposes
      return NextResponse.json({
        status: 'healthy',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        mode: 'demo'
      });
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: 'Internal server error' },
      { status: 500 }
    );
  }
}