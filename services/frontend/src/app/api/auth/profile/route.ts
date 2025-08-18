import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://auth-service.backend.svc.cluster.local:8080';
    const profileUrl = `${backendUrl}/auth/profile`;
    
    try {
      const response = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
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
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        message: 'Profile fetched (mock response)',
      });
    }
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}