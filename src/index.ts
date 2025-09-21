import { generatePrompt } from "./generate-prompt.ts";

const DEFAULTS = {
  generatePrompt: generatePrompt,
  prompts: [],
  sampleSize: 384,

  scenarioRetries: 0.01, // 1%

  perScenarioQueueConfig: {
    concurrency: 10,
    intervalCap: 1,
    interval: 1000,
  },

  percentiles: [0, 0.25, 0.5, 0.75, 0.95, 0.99],
};

// ======================================== Experiment Level

// ======================================== Scenario Level

// ======================================== Sample Level
