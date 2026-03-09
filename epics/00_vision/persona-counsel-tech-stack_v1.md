# persona-counsel — Tech Stack & Architecture

> v1 — CLI first, simple, extensible

---

## What We're Building (Plain English)

A command line tool where you load a **team of AI personas** (called a **counsel**) and chat with them. Each persona has a role, talks to a specific AI model, and communicates through markdown files on disk. A **deterministic orchestrator** (just regular code, not AI) manages the order of who talks when. An optional **interpreter** persona translates your natural language into structured instructions the orchestrator can act on.

---

## Architecture Diagram

```
You (terminal)
      │
      │  counsel summon codingTeam
      ▼
┌─────────────────────────────────────┐
│           INTERPRETER               │
│      (small, cheap LLM)             │
│                                     │
│  "count to 10 alternating"          │
│   → { target: 10,                   │
│       queue: [french, english, ...] │
│     }                               │
└──────────────┬──────────────────────┘
               │  structured intent
               ▼
┌─────────────────────────────────────┐
│           ORCHESTRATOR              │
│      (Python / Typer — no LLM)      │
│                                     │
│  - Acts on structured intent        │
│  - Builds queue of personas         │
│  - Injects global context           │
│  - Writes conversation to disk      │
└──────────────┬──────────────────────┘
               │
               │  sequential queue (in-memory, v1)
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│  Persona A  │  │  Persona B  │
│  (Claude)   │  │  (GPT-4o)   │
│             │  │             │
│ role: french│  │role: english│
│ context: ✓  │  │ context: ✓  │
└──────┬──────┘  └──────┬──────┘
       │                │
       ▼                ▼
┌─────────────────────────────────────┐
│         MARKDOWN FILES (disk)       │
│                                     │
│  session.md       ← conversation    │
│  counsels/        ← team configs    │
│  personas/        ← persona library │
└─────────────────────────────────────┘
```

---

## The Stack (v1)

### 1. Typer — The CLI Framework
**What it is:** A Python library that turns your Python functions into terminal commands.

**Why we chose it:** Beginner friendly, modern, gives you nice help text automatically.

**What it does in persona-counsel:**
- Powers `counsel summon <name>`
- Powers `counsel list`
- Runs the interactive chat REPL

**Docs:** https://typer.tiangolo.com

---

### 2. LiteLLM — The AI Bridge
**What it is:** A single Python library that talks to ANY AI provider — Claude, GPT, Gemini, Ollama (local models), and more — using the same interface.

**Why we chose it:** Without this, you'd have to write different code for each AI provider. LiteLLM means each persona can use a different model and you don't care.

**What it does in persona-counsel:**
- Each persona sends its message through LiteLLM
- You configure `model: claude-haiku-4-5` or `model: gpt-4o-mini` per persona
- The interpreter also uses LiteLLM — just pointed at a cheap, fast model
- Same code works for all of them

**Example:**
```python
# This works for ANY model, just change the model string
response = litellm.completion(
    model="claude-haiku-4-5",
    messages=[{"role": "user", "content": "Count to 10 in French"}]
)
```

**Docs:** https://docs.litellm.ai

---

### 3. In-Memory Queue — The Orchestrator's Scheduler
**What it is:** A simple Python list that acts as a to-do list for the orchestrator.

**Why we chose it (v1):** No extra software to install. Just works. The interpreter figures out the queue order, the orchestrator runs it one persona at a time.

**What it looks like:**
```python
queue = ["french", "english", "french", "english", ...]
# runs french first, waits for it to finish, then english, etc.
```

**Upgrade path (v2):** Swap for Redis + Celery when you need persistence, retries, or parallel execution.

---

### 4. Pydantic — Config Validation
**What it is:** A Python library that validates data structures. Think of it as a spell-checker for your config files.

**Why we chose it:** When you define a persona in a config file, Pydantic makes sure it has all the required fields and the right types. Catches mistakes early with clear error messages.

**What it does in persona-counsel:**
- Validates persona configs when loaded
- Validates counsel configs when loaded
- Makes sure each persona has a `name`, `model`, `role` at minimum
- Clear errors if something is missing or wrong

**Docs:** https://docs.pydantic.dev

---

### 5. PyYAML — Config File Parsing
**What it is:** Reads YAML files into Python dictionaries.

**Why YAML for config:** Human readable, easy to write, widely understood.

**Two levels of config:**

**Persona files** — reusable, live in `personas/`:
```yaml
# personas/french.yaml
name: french
model: claude-haiku-4-5
role: "You are a French language expert. Always respond in French."
```

```yaml
# personas/english.yaml
name: english
model: gpt-4o-mini
role: "You are an English language expert. Always respond in English."
```

**Counsel files** — teams of personas, live in `counsels/`:
```yaml
# counsels/counting-team.yaml
name: countingTeam
interpreter:
  model: claude-haiku-4-5   # cheap model for interpreting instructions
personas:
  - french                   # references personas/french.yaml
  - english                  # references personas/english.yaml
```

Counsels can also **override** persona fields for that team:
```yaml
personas:
  - french                   # loads personas/french.yaml as-is
  - english:                 # loads personas/english.yaml but overrides model
      model: claude-haiku-4-5
```

This means you can build a library of reusable personas and mix/match them across many different teams.

---

### 6. Global Context — Shared Memory Between Personas
**What it is:** A shared conversation log that every persona in the session can read before responding.

**Why it matters:** For the counting test to work, when it's `english`'s turn, it needs to know that `french` just said "Un" — so it knows to say "Two" next. Global context is how that works.

**How it works in v1:**
- Every persona response is appended to the session log
- Before each persona runs, the full session log is passed as context
- Each persona can see everything that has been said so far

**What the session log looks like:**
```markdown
## french
Un

## english
Two

## french
Trois

## english
Four
```

---

### 7. The Interpreter — Natural Language → Structured Intent
**What it is:** A special built-in persona that sits between you and the orchestrator. It translates what you say in plain language into structured instructions the orchestrator can execute deterministically.

**Why we need it:** The orchestrator is deterministic — it can't reason. When you say "count to 10 alternating french and english", something needs to understand that and turn it into a queue. That's the interpreter's job.

**What it does:**
```
You say:   "count to 10, alternating french and english"
           ↓
Interpreter outputs:
{
  "queue": ["french","english","french","english","french",
            "english","french","english","french","english"],
  "context": "count to 10 alternating, continue from last number"
}
           ↓
Orchestrator executes the queue blindly — no reasoning needed
```

**Key design decisions:**
- Uses a small, cheap, fast model (Haiku, gpt-4o-mini) — no need for a powerful model just to parse intent
- Configured per counsel in the counsel YAML
- Is itself a persona under the hood — just a special built-in one

---

### 8. Langfuse — Observability *(v2, but designed for from day one)*
**What it is:** A tool that records every AI call — what was sent, what came back, how long it took, how much it cost.

**Why we're planning for it now:** If you ignore observability early, adding it later is painful. We'll structure the code so adding Langfuse in v2 is just dropping in a few lines.

**What it will show you:**
- Full trace of every persona run
- Token usage and cost per persona
- Which steps failed and why

**Docs:** https://langfuse.com/docs

---

## How a v1 Session Works (Step by Step)

```
1. You run:
   $ counsel summon countingTeam

2. Orchestrator loads counsels/counting-team.yaml
   → Loads personas/french.yaml and personas/english.yaml
   → Validates everything with Pydantic
   → Prints: "countingTeam loaded. 2 personas ready."

3. You enter the chat REPL:
   > count to 10, alternating french and english

4. Interpreter runs:
   → Receives your message + list of available personas
   → Outputs structured queue:
     ["french","english","french","english"... x10]
   → Passes context: "alternating count, continue from last number"

5. Orchestrator runs the queue sequentially:

   → french persona:
      receives: system role + task context + session log (empty)
      responds: "Un"
      appended to session.md

   → english persona:
      receives: system role + task context + session log
      session log now shows french said "Un"
      responds: "Two"
      appended to session.md

   → french persona again:
      sees "Un" and "Two" in session log
      responds: "Trois"

   ... continues until 10

6. Final output in terminal:
   french:  Un
   english: Two
   french:  Trois
   english: Four
   french:  Cinq
   english: Six
   french:  Sept
   english: Eight
   french:  Neuf
   english: Ten

7. session.md on disk contains the full human-readable trace.
```

---

## File Structure (v1)

```
persona-counsel/
│
├── counsel/               ← your CLI package
│   ├── __init__.py
│   ├── main.py            ← Typer CLI entry point
│   ├── orchestrator.py    ← queue + dispatch logic
│   ├── interpreter.py     ← natural language → structured intent
│   ├── persona.py         ← persona model + LiteLLM calls
│   └── config.py          ← Pydantic config models
│
├── personas/              ← reusable persona library
│   ├── french.yaml
│   └── english.yaml
│
├── counsels/              ← counsel (team) definitions
│   └── counting-team.yaml
│
├── sessions/              ← conversation logs (auto-created)
│   └── 2026-03-09-countingTeam.md
│
├── pyproject.toml         ← project config + dependencies
└── README.md
```

---

## Dependencies Summary

| Library | Purpose | Required for v1? |
|---|---|---|
| typer | CLI commands + REPL | ✅ Yes |
| litellm | Talk to any LLM | ✅ Yes |
| pydantic | Config validation | ✅ Yes |
| pyyaml | Read YAML configs | ✅ Yes |
| langfuse | Observability + tracing | ⏳ v2 |
| redis + celery | Persistent queue | ⏳ v2 |

---

## What v1 Does NOT Have (By Design)

- No Redis, no Celery — queue is just a Python list
- No per-persona disk access scoping — all personas read/write freely
- No UI — CLI only
- No VS Code extension — later layer

The goal of v1 is to prove the loop works end to end:

**load a counsel → interpreter parses intent → personas respond in order with shared context → markdown trace on disk**

---

*persona-counsel — start simple, build up*
