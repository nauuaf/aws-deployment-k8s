import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const status = {
      timestamp: new Date().toISOString(),
      kubernetes: {
        available: false,
        namespaces: [],
        pods: {},
        jobs: []
      },
      activeExperiments: [],
      systemHealth: {
        backend: 'unknown',
        frontend: 'unknown'
      }
    };

    try {
      // Check if kubectl is available
      await execAsync('kubectl version --client --short');
      status.kubernetes.available = true;

      // Get namespaces
      try {
        const { stdout: namespaces } = await execAsync('kubectl get namespaces --no-headers -o custom-columns=":metadata.name"');
        status.kubernetes.namespaces = namespaces.trim().split('\n').filter((ns: string) => ns.trim());
      } catch (e) {
        console.log('Failed to get namespaces:', e instanceof Error ? e.message : 'Unknown error');
      }

      // Get pods in relevant namespaces
      for (const namespace of ['backend', 'frontend', 'default']) {
        try {
          const { stdout: pods } = await execAsync(`kubectl get pods -n ${namespace} --no-headers -o custom-columns=":metadata.name,:status.phase"`);
          const podList = pods.trim().split('\n')
            .filter((line: string) => line.trim())
            .map((line: string) => {
              const [name, phase] = line.trim().split(/\s+/);
              return { name, phase };
            });
          (status.kubernetes.pods as any)[namespace] = podList;
        } catch (e) {
          (status.kubernetes.pods as any)[namespace] = [];
        }
      }

      // Get chaos-related jobs
      try {
        const { stdout: jobs } = await execAsync('kubectl get jobs --all-namespaces --no-headers -o custom-columns=":metadata.namespace,:metadata.name,:status.conditions[*].type" | grep stress');
        status.kubernetes.jobs = jobs.trim().split('\n')
          .filter((line: string) => line.trim())
          .map((line: string) => {
            const parts = line.trim().split(/\s+/);
            return {
              namespace: parts[0],
              name: parts[1],
              status: parts[2] || 'Unknown'
            };
          });
      } catch (e) {
        // No stress jobs found
      }

      // Check system health based on pod status
      const backendPods = (status.kubernetes.pods as any).backend || [];
      const frontendPods = (status.kubernetes.pods as any).frontend || [];
      
      status.systemHealth.backend = backendPods.length > 0 && 
        backendPods.every((pod: any) => pod.phase === 'Running') ? 'healthy' : 'degraded';
      status.systemHealth.frontend = frontendPods.length > 0 && 
        frontendPods.every((pod: any) => pod.phase === 'Running') ? 'healthy' : 'degraded';

    } catch (kubectlError) {
      status.kubernetes.available = false;
      console.log('kubectl not available:', kubectlError instanceof Error ? kubectlError.message : 'Unknown error');
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Chaos status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get chaos status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}