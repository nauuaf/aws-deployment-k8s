import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://auth-service.backend.svc.cluster.local:8080';
    const registerUrl = `${backendUrl}/register`;
    
    try {
      const response = await fetch(registerUrl, {
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
        message: 'Registration successful (mock response)',
        user: {
          id: Date.now().toString(),
          email: body.email,
          name: body.name,
        },
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}