# TabbyAPI / ExLlama Caching-Friendly Prompting

## Is Caching Available?

Yes, but there are different kinds of caching, and they matter in different ways.

## 1. KV / Prompt Cache

TabbyAPI / ExLlama uses a key/value cache while generating. This is the main inference cache that matters for local model performance. It avoids recomputing tokens that have already been processed inside an active generation context.

Current config:

```text
max_seq_len: 32768
cache_size: 32768
cache_mode: Q4
```

What this means:

- A 32k-token KV cache is allocated.
- `Q4` cache compression helps fit longer context on the RTX 4070.
- This is the main cache setting that matters for long-context local inference.

## 2. Prefix Reuse / Cached Prompt Tokens

The backend can report `cached_tokens`, which means it may reuse already-processed prompt portions in some scheduling cases.

This helps most when requests share a long identical prefix, for example:

- the same system prompt
- the same DSL docs
- the same output schema

For this game, a good high-level prompt shape is:

1. System rules
2. DSL / action docs
3. Output schema
4. World state
5. Recent conversation
6. Current user intent

The key rule is: put the most stable content first, and keep it byte-for-byte consistent when possible.

Even small changes can reduce cache reuse:

- timestamps
- random IDs
- reordered lists
- changing whitespace
- regenerated summaries

## 3. Response Cache

This is not the main built-in TabbyAPI feature.

TabbyAPI does not generally behave like a persistent memoization layer for:

`same prompt -> same answer`

If that is useful, it should be implemented in the game or server layer.

## 4. Semantic / Application Cache

This is also something to build outside TabbyAPI.

Examples:

- cache parsed action schemas
- cache NPC behavior docs
- cache retrieval results
- cache embeddings or ranked context candidates

This can reduce repeated prompt assembly and cut unnecessary context from requests.

## Best Practical Strategy For This Game

The most useful approach is likely:

- Keep TabbyAPI KV cache enabled.
- Add an app-level prompt assembly cache.
- Avoid resending huge unchanged DSL docs when IDs, summaries, or retrieval can be used instead.

## If DSL Action Docs Change Dynamically

If the action docs may change because of a smart context chooser, do not put all of them into the static prefix.

Instead, split the prompt into two layers:

### Static Core Prompt

Keep these stable and near the front:

- You are the game action interpreter.
- Output only JSON.
- General DSL grammar.
- Global constraints.
- Common action schema.

### Dynamic Selected Context

Append these later in the prompt:

- only the action docs relevant to the current player intent
- relevant variables and entities
- current NPC or location state
- current world state

## Recommended Prompt Order

For this game, a better ordering is:

1. System / developer rules
2. Stable JSON contract
3. Stable DSL rules
4. Stable action format conventions
5. Selected action docs for this turn
6. Current game state / variables
7. Recent conversation
8. Player's latest input

Why:

- Prefix caching works best when the beginning of the prompt stays identical between calls.
- If the first several thousand tokens stay the same, the backend has a better chance of reusing that processed prefix.
- If dynamic state appears at the top, cache reuse becomes much weaker because each request differs from token 1 onward.

## Example Prompt Shape

```text
STATIC PREFIX
You convert player intent into game-engine JSON.
Return only JSON matching this schema:
...
DSL grammar:
...
Global action rules:
...

DYNAMIC ACTION CONTEXT
Available actions this turn:
- move_to(...)
- repair_item(...)
- buy_item(...)
...

DYNAMIC GAME CONTEXT
Current location:
Current NPC:
Inventory:
Relevant variables:

USER INPUT
"Can you fix my sword?"
```

## Does More Cache Reuse Make Responses Faster?

Usually yes.

LLM latency has two main phases:

1. Prompt processing / prefill
2. Token generation / decode

### Prompt Processing / Prefill

The model reads the full input prompt.

### Token Generation / Decode

The model generates the answer token by token.

Cache reuse mostly speeds up phase 1.

That means it helps most when prompts are large.

Example where caching helps a lot:

- 20k-token prompt
- 200-token answer

Example where caching matters much less:

- 1k-token prompt
- 200-token answer

In this DSL game, caching can be especially useful because many requests may repeatedly include:

- JSON rules
- DSL grammar
- action conventions
- schema examples

If those stay identical at the front of the prompt, the model may avoid reprocessing many of those tokens on every call.

## Important Limitation

Cache reuse does not make generation itself magically faster.

A 300-token answer still has to be generated token by token. The main gain is reducing the repeated cost of reading the same long instruction and context prefix.
