import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api-service.backend.svc.cluster.local:3000';
    const usersUrl = `${backendUrl}/api/v1/users`;
    
    try {
      const response = await fetch(usersUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // If it's a 403 (forbidden), provide a helpful message
        if (response.status === 403) {
          return NextResponse.json({
            error: 'Access denied',
            message: 'This endpoint requires admin privileges',
            users: []
          }, { status: 403 });
        }
        return NextResponse.json(data, { status: response.status });
      }

      return NextResponse.json(data);
    } catch (fetchError) {
      console.error('Failed to reach API service:', fetchError);
      // Return a mock response for development
      return NextResponse.json({
        users: [
          { id: '1', name: 'Ahmed Al-Rashid', email: 'ahmed@example.com', role: 'admin' },
          { id: '2', name: 'Khalid Ahmed', email: 'Khalid@example.com', role: 'user' },
        ],
        message: 'Users fetched (mock response)',
      });
    }
  } catch (error) {
    console.error('Users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api-service.backend.svc.cluster.local:3000';
    const usersUrl = `${backendUrl}/api/v1/users`;
    
    try {
      const response = await fetch(usersUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
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
      console.error('Failed to reach API service:', fetchError);
      // Return a mock response for development
      return NextResponse.json({
        user: {
          id: Date.now().toString(),
          name: body.name,
          email: body.email,
          role: body.role || 'user',
        },
        message: 'User created (mock response)',
      });
    }
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}