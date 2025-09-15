import ping from "ping";
import { Benchmark } from "./types.ts";

const now = () => performance.now();

export class Recorder {
  constructor(public bm: Benchmark, public prompt: string) {}

  failed = false;
  error: any = null;
  setError = (error: any) => {
    this.error = error;
    this.failed = true;
    console.error(`benchmark (${this.bm.id}) error: `, error);
  };

  startTime: Date;

  beginAt?: number;
  endAt?: number;
  tokens: TokenItem[] = [];

  firstTokenAt?: number;
  lastTokenAt?: number;

  get ttft() {
    return this.ttft_w_network && this.ttft_w_network - this.pingMs;
  }

  get ttft_w_network() {
    return this.firstTokenAt && this.beginAt
      ? this.firstTokenAt - this.beginAt - this.pingMs
      : NaN;
  }
  get tt_complete() {
    return this.lastTokenAt && this.beginAt
      ? this.lastTokenAt - this.beginAt
      : NaN;
  }

  pingMs = 0;
  doPing = async () => {
    try {
      const res = await ping.promise.probe(this.bm.host, { timeout: 5 });
      if (res.alive && res.time !== "unknown") this.pingMs = res.time;
    } catch (error) {}

    if (!this.pingMs)
      console.warn(
        `ping failed on (${this.bm.host}). network latency will be included in benchmark`,
      );

    return this.pingMs;
  };

  begin = () => {
    this.beginAt = now();
    this.startTime = new Date();
  };
  end = () => {
    this.endAt = now();
    if (!this.tokens.length) return;
    this.lastTokenAt = this.tokens[this.tokens.length - 1].createdAt;
  };

  addToken = (token: string | undefined | null) => {
    if (!token) return;

    if (!this.firstTokenAt) this.firstTokenAt = now();
    this.tokens.push({ content: token, createdAt: now() });
  };
}

interface TokenItem {
  content: string;
  createdAt: number;
}
