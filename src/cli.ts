#!/usr/bin/env node

import { loadWorkflow } from './workflow/loader.js';
import { LinearClient } from './tracker/linear.js';
import { Orchestrator } from './orchestrator.js';

const USAGE = `
Bellows — Pi-native agent orchestrator

Usage:
  bellows start [workflow-path]    Start the orchestrator daemon
  bellows status                  Show current status
  bellows stop                    Stop the daemon
  bellows --version               Show version

Examples:
  bellows start                   # Uses ./WORKFLOW.md
  bellows start ./my-workflow.md  # Use custom workflow file

Environment:
  LINEAR_API_KEY      Required for Linear tracker
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const workflowPath = args[1] ?? './WORKFLOW.md';

  switch (command) {
    case 'start':
      await startOrchestrator(workflowPath);
      break;
    
    case 'status':
      console.log('Status command not yet implemented');
      process.exit(0);
      break;
    
    case 'stop':
      console.log('Stop command not yet implemented');
      process.exit(0);
      break;
    
    case '--version':
    case '-v':
      console.log('bellows v0.1.0');
      process.exit(0);
      break;
    
    case '--help':
    case '-h':
    default:
      console.log(USAGE);
      process.exit(command ? 1 : 0);
  }
}

async function startOrchestrator(workflowPath: string): Promise<void> {
  console.log(`Loading workflow from ${workflowPath}...`);
  
  const { config, promptTemplate } = await loadWorkflow(workflowPath);
  
  console.log('Workflow loaded:');
  console.log(`  Tracker: ${config.tracker!.kind}`);
  console.log(`  Project: ${config.tracker!.projectSlug ?? 'N/A'}`);
  console.log(`  Active states: ${config.tracker!.activeStates.join(', ')}`);
  console.log(`  Terminal states: ${config.tracker!.terminalStates.join(', ')}`);
  
  // Create tracker client
  const tracker = new LinearClient({
    apiKey: config.tracker!.apiKey,
    projectSlug: config.tracker!.projectSlug!,
    endpoint: config.tracker!.endpoint,
  });
  
  // Create orchestrator
  const orchestrator = new Orchestrator({
    config,
    promptTemplate,
    tracker,
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    orchestrator.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    orchestrator.stop();
    process.exit(0);
  });
  
  // Start
  orchestrator.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
