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

    console.log(`[Chaos Engineering] Starting scenario: ${scenario} for ${duration}ms`);

    // Execute actual chaos engineering commands based on scenario
    const result = await executeChaosScenario(scenario, duration);

    return NextResponse.json({
      success: true,
      message: `Chaos scenario '${scenario}' executed successfully`,
      scenario,
      duration,
      startTime: new Date().toISOString(),
      expectedEndTime: new Date(Date.now() + duration).toISOString(),
      actions: result.actions,
      status: result.status,
      details: result.details
    });

  } catch (error) {
    console.error('Chaos API error:', error);
    return NextResponse.json(
      { error: 'Failed to execute chaos scenario', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function executeChaosScenario(scenario: string, duration: number) {
  const { spawn } = require('child_process');
  
  switch (scenario) {
    case 'pod-killer':
      return await executePodKiller();
    case 'memory-stress':
      return await executeMemoryStress(duration);
    case 'network-partition':
      return await executeNetworkPartition(duration);
    case 'traffic-surge':
      return await executeTrafficSurge(duration);
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

async function executePodKiller() {
  try {
    // List pods in backend namespace and randomly select one to restart
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // Try to get pods from backend namespace
      const { stdout: backendPods } = await execAsync('kubectl get pods -n backend --no-headers -o custom-columns=":metadata.name"');
      const pods = backendPods.trim().split('\n').filter((pod: string) => pod.trim());
      
      if (pods.length > 0) {
        const randomPod = pods[Math.floor(Math.random() * pods.length)];
        await execAsync(`kubectl delete pod ${randomPod} -n backend`);
        
        return {
          status: 'executed',
          actions: [`Deleted pod ${randomPod} in backend namespace`],
          details: `Pod ${randomPod} was terminated. Kubernetes will automatically restart it.`
        };
      }
    } catch (backendError) {
      // Fallback to frontend namespace if backend doesn't exist
      try {
        const { stdout: frontendPods } = await execAsync('kubectl get pods -n frontend --no-headers -o custom-columns=":metadata.name"');
        const pods = frontendPods.trim().split('\n').filter((pod: string) => pod.trim());
        
        if (pods.length > 0) {
          const randomPod = pods[Math.floor(Math.random() * pods.length)];
          await execAsync(`kubectl delete pod ${randomPod} -n frontend`);
          
          return {
            status: 'executed',
            actions: [`Deleted pod ${randomPod} in frontend namespace`],
            details: `Pod ${randomPod} was terminated. Kubernetes will automatically restart it.`
          };
        }
      } catch (frontendError) {
        // Final fallback - simulate the action
        return {
          status: 'simulated',
          actions: ['Simulated pod termination (kubectl not available)'],
          details: 'No Kubernetes cluster available. This would normally restart a random pod to test resilience.'
        };
      }
    }

    return {
      status: 'skipped',
      actions: ['No pods found to terminate'],
      details: 'No running pods were found in the target namespaces.'
    };
  } catch (error) {
    return {
      status: 'simulated',
      actions: ['Simulated pod termination (execution failed)'],
      details: `Would normally restart a random pod. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function executeMemoryStress(duration: number) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // Try to apply memory stress using kubectl
      const stressManifest = `
apiVersion: batch/v1
kind: Job
metadata:
  name: memory-stress-${Date.now()}
  namespace: backend
spec:
  template:
    spec:
      containers:
      - name: stress
        image: progrium/stress
        args: ["--vm", "1", "--vm-bytes", "256M", "--timeout", "${Math.floor(duration/1000)}s"]
      restartPolicy: Never
  backoffLimit: 0
`;
      
      // Create temporary manifest file and apply it
      const fs = require('fs');
      const manifestPath = `/tmp/stress-${Date.now()}.yaml`;
      fs.writeFileSync(manifestPath, stressManifest);
      
      await execAsync(`kubectl apply -f ${manifestPath}`);
      
      // Clean up manifest file
      fs.unlinkSync(manifestPath);
      
      return {
        status: 'executed',
        actions: ['Created memory stress job in backend namespace'],
        details: `Memory stress test running for ${Math.floor(duration/1000)} seconds using stress container.`
      };
    } catch (error) {
      return {
        status: 'simulated',
        actions: ['Simulated memory stress test'],
        details: `Would normally create memory pressure on pods for ${Math.floor(duration/1000)} seconds. Kubernetes not available.`
      };
    }
  } catch (error) {
    return {
      status: 'simulated',
      actions: ['Simulated memory stress test'],
      details: `Would apply memory pressure to test system behavior under load.`
    };
  }
}

async function executeNetworkPartition(duration: number) {
  return {
    status: 'simulated',
    actions: ['Simulated network partition between services'],
    details: `Would normally isolate network traffic between services for ${Math.floor(duration/1000)} seconds using network policies or iptables rules.`
  };
}

async function executeTrafficSurge(duration: number) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // Try to scale up frontend deployment to simulate traffic handling
      await execAsync('kubectl scale deployment frontend-deployment -n frontend --replicas=3');
      
      // Schedule scale down after duration
      setTimeout(async () => {
        try {
          await execAsync('kubectl scale deployment frontend-deployment -n frontend --replicas=1');
        } catch (e) {
          console.log('Failed to scale down deployment:', e instanceof Error ? e.message : 'Unknown error');
        }
      }, duration);
      
      return {
        status: 'executed',
        actions: ['Scaled frontend deployment to 3 replicas', 'Scheduled scale-down after duration'],
        details: `Scaled up frontend to handle increased traffic. Will scale back down in ${Math.floor(duration/1000)} seconds.`
      };
    } catch (error) {
      return {
        status: 'simulated',
        actions: ['Simulated traffic surge'],
        details: `Would normally scale up deployments and generate load to test performance under high traffic.`
      };
    }
  } catch (error) {
    return {
      status: 'simulated',
      actions: ['Simulated traffic surge'],
      details: `Would generate high load to test system performance and auto-scaling capabilities.`
    };
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