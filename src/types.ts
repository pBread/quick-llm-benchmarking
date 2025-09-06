import type { Recorder } from "./recorder.ts";

export type RunMap = Map<string, Set<Recorder>>;

export interface Benchmark {
  id: string;
  fn: Executor;
  host: string; // api host to remove local network latency
  queueKey?: string; // allows queues to be shared
}

export type Executor = (rec: Recorder) => Promise<void>;
