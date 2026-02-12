
# ScribeAI

A real-time AI content generation platform built with Stream Chat, Groq, React, Node.js, and Supabase.

---

## Overview

ScribeAI is a full-stack AI content generation system designed as a **session-based content workspace**, not just a chat interface.

It is built specifically to support structured content creation such as:

* Articles
* Professional emails
* Summaries
* Rewrites
* Explanations
* Content refinement

Instead of directly calling an LLM from the frontend, the system is architected around a clean separation of concerns:

* **Stream Chat** → real-time event transport and session management
* **Express backend** → AI orchestration and control layer
* **Groq (LLM)** → content generation engine
* **Supabase** → structured conversation persistence
* **React + TypeScript** → responsive content-focused UI

The system is intentionally:

* Provider-agnostic
* Event-driven
* Production-safe
* Designed for controlled, predictable content generation

This architecture ensures scalability, reliability, and clean extensibility as content features evolve.

---

# System Architecture

```
Frontend (React + Stream SDK)
        │
        │ REST (token)
        ▼
Backend (Express)
        │
        │ Stream Webhook Events
        ▼
Stream Chat (Event Bus)
        │
        ▼
Groq LLM
```

## Layer Responsibilities

| Layer    | Responsibility                                                   |
| -------- | ---------------------------------------------------------------- |
| Frontend | UI rendering, session management, streaming animation            |
| Backend  | AI orchestration, webhook processing, rate limiting, persistence |
| Stream   | Real-time message delivery and channel management                |
| Groq     | Text generation only                                             |

### Architectural Philosophy

* Stream handles transport.
* Backend handles intelligence and control.
* Groq generates text.
* Frontend renders state.

Each layer has a single responsibility.

---

# Key Features

## Real-Time AI Writing Workspace

* Each Stream channel represents a writing session.
* URL-aware routing allows direct session access.
* Sidebar shows sessions sorted by last activity.
* Sessions can be deleted safely.
* AI responses appear in real-time with smooth streaming animation.

The system avoids mixing UI logic with AI logic.

---

## Safe Webhook Processing

Stream sends webhook events for many actions. The backend only processes:

```
event.type === "message.new"
```

### Protections Implemented

* Ignores AI-generated messages (prevents infinite loops).
* Deduplicates webhook retries using message ID cache.
* Auto-cleans duplicate cache (TTL: 5 minutes).
* Memory cap prevents unbounded growth.

This ensures production reliability.

---

## Intelligent Prompt System

Instead of sending raw user text to the LLM, ScribeAI:

1. Detects user intent.
2. Selects a strict system prompt.
3. Adjusts temperature and token limits.

Supported intents:

* `write`
* `summarize`
* `explain`
* `rephrase`
* `generic`

This keeps outputs predictable and aligned with writing use cases.

---

## Short-Term AI Memory

To prevent token explosion:

* Only the last 6 messages are fetched from Supabase.
* Context is formatted clearly as:

```
User: ...
Assistant: ...
User: ...
```

This provides memory without high token cost or degraded performance.

---

## Session Title Generation

When the first user message is received:

* A deterministic title is generated.
* First 6 words are extracted.
* Title is capitalized and trimmed.
* Saved to database.
* Remains stable for the lifetime of the session.

No AI call is used for titles.

---

## Idempotent Database Writes

All message writes use:

```ts
.upsert(message, { onConflict: "id" })
```

This guarantees:

* Safe retries
* No duplicate rows
* Webhook reliability
* Database consistency

The system assumes webhooks can retry and is built accordingly.

---

## Rate Limiting

A lightweight per-channel rate limiter prevents:

* Prompt flooding
* Abuse of Groq API
* Accidental spam loops

The limiter is stateless and memory-based.

---

## UX Signals (Backend-Controlled)

Before generating a response:

* AI typing indicator is started.

After response:

* Typing indicator is stopped.
* Final AI message is sent.

Frontend handles visual streaming animation separately to maintain smooth UX.

---

# Frontend Architecture

## Tech Stack

* React + TypeScript
* Vite
* TailwindCSS
* shadcn/ui
* stream-chat-react
* react-markdown
* lucide-react

---

## Component Structure

```
App
 ├─ ChatSidebar
 ├─ ChatInterface
 │   ├─ MessageList
 │   ├─ ChatMessage
 │   ├─ WritingPromptsToolbar
 │   └─ ChatInput
```

Each component has a single responsibility.

---

## Design Principles

* No LLM logic in frontend.
* Stream is the source of truth.
* Backend controls intelligence.
* Stateless UI rendering.
* Provider-agnostic architecture.

The frontend never calls Groq or OpenAI directly.

---

## Visual Streaming

Frontend uses a controlled streaming hook:

```ts
useMessageTextStreaming(...)
```

This creates:

* Smooth typing illusion
* Deterministic animation
* No backend streaming complexity
* Better perceived performance

Streaming is visual, not token-level.

---

# Backend Architecture

## Tech Stack

* Node.js (>=20)
* Express
* Groq SDK
* Stream Server SDK
* Supabase
* Helmet
* CORS
* Morgan logging

---

## Webhook Flow

```
User sends message
   ↓
Stream triggers webhook
   ↓
Validate event type
   ↓
Ignore AI messages
   ↓
Duplicate message check
   ↓
Rate limit check
   ↓
Generate session title (if first message)
   ↓
Persist user message
   ↓
Fetch context (last 6 messages)
   ↓
Detect intent
   ↓
Build system prompt
   ↓
Call Groq
   ↓
Send AI message to Stream
   ↓
Persist AI message
```

This flow is deterministic and defensive.

---

# Reliability Mechanisms

## Infinite Loop Protection

```ts
if (message.user?.id?.startsWith("ai-bot-")) return;
```

Prevents AI from responding to itself.

---

## Duplicate Webhook Protection

```ts
const processedMessages = new Map<string, number>();
```

* TTL: 5 minutes
* Auto cleanup
* Memory cap

Ensures idempotency at the webhook layer.

---

## Idempotent Writes

```ts
.upsert(message, { onConflict: "id" })
```

Database safety is guaranteed.

---

# Prompt Engineering Strategy

|Intent     | Temperature | Max Tokens |
| --------- | ----------- | ---------- |
| write     | 0.7         | 700        |
| explain   | 0.4         | 350        |
| summarize | 0.4         | 350        |
| generic   | 0.5         | 500        |

This prevents:

* Overly creative factual responses
* Robotic outputs
* Hallucinated verbosity
* Excess token usage

---

# Database Design

## channels

* id
* title
* created_at

## messages

* id (Stream message ID)
* channel_id
* role (user | ai)
* content
* created_at

### Design Goals

* Minimal schema
* Idempotent writes
* Easy to extend
* No LLM coupling
* Clean session separation

---

# Challenges Solved

## Infinite AI Loop

AI responded to itself.
Fixed using explicit AI-user ID guard.

---

## Duplicate Replies from Webhook Retries

Stream retried webhook events.
Fixed using message ID memory cache.

---

## Railway 502 & Startup Crashes

Healthcheck logic caused failures.
Replaced with `getAppSettings()` validation.

---

## Token Explosion

Full history was sent to LLM.
Limited context to last 6 messages.

---

## Unstable Chat Titles

Titles changed unpredictably.
Replaced with deterministic first-message-based generation.

---

# Security Considerations

* No LLM keys exposed to frontend.
* Stream tokens signed server-side.
* Explicit CORS configuration.
* Helmet security headers enabled.
* No secret logging.
* Defensive webhook handling.

---

# Why This Architecture Works

* Event-driven design
* Clean separation of concerns
* Provider-agnostic LLM layer
* Defensive webhook patterns
* Idempotent database model
* Predictable prompt control
* Scalable horizontally

This is not a single-endpoint AI wrapper.
It is a structured, extensible system.

---

# Mental Model

> Stream moves messages.
> Backend decides intelligence.
> Groq generates text.
> Frontend renders state.

That separation is what makes ScribeAI stable and extensible.

---
