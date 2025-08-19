# Quick LLM Benchmarks for Voice Agents

This repo is a simple, plug-and-play benchmark suite for LLM APIs with a voice-first focus.

This includes:

1. Assistants API
2. Chat Completions API
3. Responses API

Each run:

- Generates a unique run ID
- Executes the same set of prompts (benchmarks) against each API sequentially
- Captures TTFT for each benchmark
- Writes one JSON file per API under `./logs/<RUN_ID>/`
