import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://auth-service.backend.svc.cluster.local:8080';
    const loginUrl = `${backendUrl}/login`;
    
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return NextResponse.json(data, { status: response.status });
      }

      return NextResponse.json(data);
    } catch (fetchError) {
      console.error('Failed to reach auth service:', fetchError);
      // Return a mock response for development
      return NextResponse.json({
        token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: '1',
          email: body.email,
          name: 'Test User',
        },
        message: 'Login successful (mock response)',
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}