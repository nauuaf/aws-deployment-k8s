import { NextRequest, NextResponse } from 'next/server';

interface ChaosRequest {
  scenario: string;
  duration: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChaosRequest = await request.json();
    const { scenario, duration } = body;

    // Validate the scenario
    const validScenarios = ['pod-killer', 'memory-stress', 'network-partition', 'traffic-surge'];
    if (!validScenarios.includes(scenario)) {
      return NextResponse.json(
        { error: 'Invalid scenario type' },
        { status: 400 }
      );
    }

    // Simulate chaos engineering execution
    // In a real implementation, this would interact with chaos engineering tools like:
    // - Chaos Monkey
    // - Gremlin
    // - Litmus
    // - kubectl commands to kill pods, stress test, etc.

    console.log(`[Chaos Engineering] Starting scenario: ${scenario} for ${duration}ms`);

    // Return success response immediately for async execution
    return NextResponse.json({
      success: true,
      message: `Chaos scenario '${scenario}' started successfully`,
      scenario,
      duration,
      startTime: new Date().toISOString(),
      expectedEndTime: new Date(Date.now() + duration).toISOString()
    });

  } catch (error) {
    console.error('Chaos API error:', error);
    return NextResponse.json(
      { error: 'Failed to execute chaos scenario' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    availableScenarios: [
      {
        id: 'pod-killer',
        name: 'Pod Killer',
        description: 'Randomly terminates pods to test resilience'
      },
      {
        id: 'memory-stress',
        name: 'Memory Stress',
        description: 'Applies memory pressure to test system behavior'
      },
      {
        id: 'network-partition',
        name: 'Network Partition',
        description: 'Simulates network isolation between services'
      },
      {
        id: 'traffic-surge',
        name: 'Traffic Surge',
        description: 'Generates high load to test performance'
      }
    ]
  });
}