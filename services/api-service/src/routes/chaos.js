const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');

/**
 * @swagger
 * /api/chaos/run:
 *   post:
 *     summary: Run chaos engineering scenario
 *     description: Triggers a chaos engineering scenario using the external script
 *     tags: [Chaos Engineering]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scenario:
 *                 type: string
 *                 enum: [pod-killer, traffic-surge, network-partition]
 *                 description: The chaos scenario to run
 *               duration:
 *                 type: number
 *                 description: Duration in milliseconds (optional)
 *             required:
 *               - scenario
 *     responses:
 *       200:
 *         description: Chaos scenario started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 scenario:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Invalid scenario or parameters
 *       500:
 *         description: Failed to start chaos scenario
 */
router.post('/run', asyncHandler(async (req, res) => {
  const { scenario, duration } = req.body;
  
  // Validate scenario
  const validScenarios = ['pod-killer', 'traffic-surge', 'network-partition'];
  if (!scenario || !validScenarios.includes(scenario)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid scenario',
      message: `Scenario must be one of: ${validScenarios.join(', ')}`,
      validScenarios
    });
  }

  try {
    // Simulate chaos engineering execution
    // In a real implementation, this would integrate with chaos engineering tools like:
    // - Chaos Monkey
    // - Gremlin
    // - Litmus
    // - kubectl commands to kill pods, stress test, etc.

    console.log(`[Chaos Engineering] Starting scenario: ${scenario} for ${duration}ms`);
    
    // Simulate different scenario effects
    const simulationEffects = {
      'pod-killer': 'Simulating pod termination and recovery',
      'traffic-surge': 'Simulating high traffic load generation', 
      'network-partition': 'Simulating network connectivity issues'
    };
    
    res.json({
      success: true,
      message: `Chaos engineering scenario '${scenario}' started successfully`,
      scenario,
      duration: duration || 'default',
      timestamp: new Date().toISOString(),
      simulation: true,
      effect: simulationEffects[scenario] || 'Generic chaos simulation',
      note: 'This is a demo simulation. In production, this would integrate with actual chaos engineering tools.'
    });
    
  } catch (error) {
    console.error('Chaos engineering error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start chaos scenario',
      message: error.message,
      scenario,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * @swagger
 * /api/chaos/scenarios:
 *   get:
 *     summary: Get available chaos scenarios
 *     description: Returns a list of available chaos engineering scenarios
 *     tags: [Chaos Engineering]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available chaos scenarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 scenarios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       duration:
 *                         type: string
 */
router.get('/scenarios', asyncHandler(async (req, res) => {
  const scenarios = [
    {
      id: 'pod-killer',
      name: 'Pod Killer',
      description: 'Randomly terminates backend pods to test resilience',
      duration: '60 seconds',
      effects: ['Pod termination', 'Service disruption', 'Auto-recovery testing']
    },
    {
      id: 'traffic-surge',
      name: 'Traffic Surge',
      description: 'Generates high traffic load to test scalability',
      duration: '300 seconds',
      effects: ['High CPU usage', 'Memory pressure', 'Auto-scaling triggers']
    },
    {
      id: 'network-partition',
      name: 'Network Partition',
      description: 'Simulates network issues between services',
      duration: '120 seconds',
      effects: ['Connection timeouts', 'Service isolation', 'Fallback mechanisms']
    }
  ];

  res.json({
    success: true,
    scenarios,
    total: scenarios.length,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @swagger
 * /api/chaos/status:
 *   get:
 *     summary: Get chaos engineering status
 *     description: Returns the current status of chaos engineering scenarios
 *     tags: [Chaos Engineering]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chaos engineering status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 active:
 *                   type: boolean
 *                 running_scenarios:
 *                   type: array
 *                 timestamp:
 *                   type: string
 */
router.get('/status', asyncHandler(async (req, res) => {
  // For now, we'll just return a simple status
  // In a real implementation, you might track running scenarios
  res.json({
    success: true,
    active: false,
    running_scenarios: [],
    message: 'Chaos engineering scenarios are executed via external scripts',
    timestamp: new Date().toISOString(),
    note: 'Check kubectl for active chaos resources like chaos-load-generator deployments'
  });
}));

module.exports = router;