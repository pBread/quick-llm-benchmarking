import PQueue from "p-queue";
import { generatePrompt } from "./generate-prompt.ts";

const DEFAULTS = {
  generatePrompt,
  prompts: [],
  sampleSize: 384,

  scenarioRetries: 0.01, // 1% of sample size

  perScenarioQueueConfig: {
    concurrency: 10,
    intervalCap: 1,
    interval: 1000,
  },

  percentiles: [0, 0.25, 0.5, 0.75, 0.95, 0.99],
} satisfies Required<ExperimentOptions>;

// ======================================== Experiment Level
export class Experiment {
  generatePrompt: () => string;

  percentiles: number[];
  perScenarioQueueConfig: QueueConfig;
  prompts: string[];
  sampleSize: number;
  status: ExperimentStatus = "new";

  #scenarioRetries: number;
  get scenarioRetries() {
    if (this.#scenarioRetries >= 1) return this.#scenarioRetries;
    return Math.ceil(this.sampleSize * this.#scenarioRetries); // compute pct if <1
  }

  constructor(opts: ExperimentOptions) {
    const cfg = {
      ...DEFAULTS,
      ...opts, // todo: clean undefined/nulls
    };

    this.generatePrompt = cfg.generatePrompt;

    this.#scenarioRetries = cfg.scenarioRetries;
    this.percentiles = cfg.percentiles;
    this.perScenarioQueueConfig = cfg.perScenarioQueueConfig;
    this.prompts = cfg.prompts;
    this.sampleSize = cfg.sampleSize;
  }

  start = async () => {};
}

interface ExperimentOptions {
  generatePrompt?: () => string; // not called unless prompts are undefined
  prompts?: string[]; // if sample > prompts.length then prompts will be looped back
  sampleSize?: number;
  scenarioRetries?: number; // pct or number; failures (not including warmup) per scenario before abort.

  perScenarioQueueConfig?: QueueConfig; // per scenario queue

  percentiles?: number[];
}

type ExperimentStatus =
  | "new"
  | "initializing"
  | "warmup"
  | "running"
  | "aborted"
  | "done";

// ======================================== Scenario Level

// ======================================== Sample Level

// ======================================== Other Utilities
// ========================================
// Type Helpers
// ========================================
type QueueConfig = ConstructorParameters<typeof PQueue>[0];
