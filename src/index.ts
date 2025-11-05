import PQueue from "p-queue";
import { defaultPromptGenerator } from "./generate-prompt.ts";

const DEFAULTS = {
  generatePrompt: defaultPromptGenerator,
  prompts: [],
  sampleSize: 384,

  scenarioRetries: 0.01, // 1% of sample size

  queueConfig: {
    concurrency: 10,
    intervalCap: 1,
    interval: 1000,
  },

  percentiles: [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99],
} satisfies Required<ExperimentOptions>;

// ======================================== Experiment Level
export class Experiment {
  generatePrompt: () => string;

  percentiles: number[];
  queueConfig: QueueConfig;
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
      ...cleanObject(opts),
    };

    this.generatePrompt = cfg.generatePrompt;

    this.#scenarioRetries = cfg.scenarioRetries;
    this.percentiles = cfg.percentiles;
    this.queueConfig = cfg.queueConfig;
    this.prompts = cfg.prompts;
    this.sampleSize = cfg.sampleSize;
  }

  start = async () => {};
}

interface ExperimentOptions {
  generatePrompt?: () => string; // called when no prompts are given
  prompts?: string[]; // if sampleSize > prompts.length then prompts will be reused
  sampleSize?: number;
  scenarioRetries?: number; // pct or number; failures (not including warmup) per scenario before abort.

  queueConfig?: QueueConfig; // per scenario queue

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

// ======================================== Type Helpers
type QueueConfig = ConstructorParameters<typeof PQueue>[0];

// ======================================== Other Utilities
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
}
