# Multi-Agent JS System --- Technical Specification (Contracts + Resumability)

## 0. Scope

Local-first multi-agent system with: - Separate Node processes
(agents) - Queue-based coordination (Redis + BullMQ) - File-first state
(Markdown + JSON) - Deterministic orchestration - Observability via
Langfuse - Minimal Docker (infra only) - **Explicit step contracts
(schemas)** - **Resumable runs**

------------------------------------------------------------------------

## 1. Core Principle

System is defined as:

orchestrator → queue → workers → filesystem → tracing

Agents are implementations.\
**Steps + contracts are the true abstraction.**

------------------------------------------------------------------------

## 2. Run Model

runs/`<runId>`{=html}/

meta.json: - runId - status: running \| completed \| failed -
pipelineVersion - createdAt

------------------------------------------------------------------------

## 3. Step Model

runs/`<runId>`{=html}/steps/`<nn-name>`{=html}/

Files: - input.json (required) - output.json (required, structured) -
output.md (optional human-readable) - meta.json (required)

------------------------------------------------------------------------

## 4. Step Contract System

Each step defines:

-   InputSchema
-   OutputSchema
-   Invariants

### Example

Step: 01-plan

Input: { "prompt": "string" }

Output: { "steps": \["string"\], "assumptions": \["string"\] }

Invariants: - steps.length \> 0 - steps.length \<= 10

------------------------------------------------------------------------

## 5. Validation Rules

### On agent start

-   validate input.json against InputSchema

### On completion

-   validate output.json against OutputSchema
-   validate invariants
-   only then mark success

Invalid output → fail step

------------------------------------------------------------------------

## 6. Step Metadata

meta.json: - agent - stepKey - status: running \| success \| failed -
startedAt - completedAt - traceId

------------------------------------------------------------------------

## 7. Resumable Execution

Orchestrator must support:

resume(runId)

Logic:

for step in pipeline: if meta.status == "success": skip else: execute

------------------------------------------------------------------------

## 8. Atomic Writes

All outputs must use:

write temp file → rename

Prevents partial corruption.

------------------------------------------------------------------------

## 9. Orchestrator

Responsibilities: - create run - define pipeline - enqueue jobs -
validate outputs - advance steps - resume safely

No dynamic branching.

------------------------------------------------------------------------

## 10. Agents

Responsibilities: - consume jobs - read input.json - produce
output.json + output.md - validate before write - emit traces

Constraints: - no orchestration - no direct communication

------------------------------------------------------------------------

## 11. Queue

-   Redis + BullMQ
-   one queue per agent
-   retries + backoff

------------------------------------------------------------------------

## 12. Observability

Langfuse:

Trace hierarchy: run → step → LLM/tool calls

Must log: - runId - stepKey - agent - inputs/outputs - latency

------------------------------------------------------------------------

## 13. Docker Scope

Docker runs: - Redis - Langfuse

Host runs: - orchestrator - agents

------------------------------------------------------------------------

## 14. CLI

pnpm start "prompt"

Creates run + starts pipeline

------------------------------------------------------------------------

## 15. Guarantees

System guarantees: - step outputs are valid - runs are resumable -
failures are explicit - state is inspectable

------------------------------------------------------------------------

## 16. Tradeoffs

Pros: - high clarity - debuggable - deterministic

Cons: - manual schema work - file I/O overhead

------------------------------------------------------------------------

## 17. Summary

This system is an execution engine with:

-   strict contracts
-   resumable state
-   observable behavior
-   deterministic flow
