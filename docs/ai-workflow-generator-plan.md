# In-app AI workflow generator (brainstorm)

Status: idea stage, not approved for build yet. Captured after manually building
the "MJA Test" flow + automation by hand and hitting the usual "which node do I
pick" friction.

## The idea

Right now, building a Flow or Automation means clicking through the canvas
node by node. n8n has AI plugins where you describe what you want in plain
English, an LLM that knows n8n's node schema turns that into a JSON workflow,
and you paste it in.

We want the same idea, but built *inside* this app, using the account's own
DeepSeek key (the same one already wired up for AI Agents). The key
difference from just asking an outside general-purpose LLM: an outside model
doesn't know this app's exact node types, field names, or wiring rules, so it
guesses and gets the JSON wrong. A generator built into the app can be given
the real schema as context, so it only ever produces structures the app can
actually run.

## Why this is more realistic than it sounds

Checked the current code while debugging MJA Test — a surprising amount of
the plumbing this would need already exists, just built for other reasons:

- Every flow node (`flow_nodes.config`) and automation step
  (`automation_steps.step_config`) is already stored as plain structured
  JSON, matching known TypeScript shapes (`FlowNodeConfig` union in
  `src/lib/flows/types.ts`). This is already the exact "target shape" an AI
  generator would need to produce.
- Bulk-inserting many steps at once already exists — the automation
  "duplicate" endpoint (`src/app/api/automations/[id]/duplicate/route.ts`)
  copies a whole step tree in one shot. The same insert pattern is reusable
  for "create these N steps from AI output" instead of "copy these N existing
  steps."
- `src/lib/flows/validate.ts` already checks structural correctness (the "2
  errors" we saw on the MJA Test canvas — dangling `next_node_key`, missing
  required fields). This is a ready-made safety net: run AI output through
  it before accepting, reject or ask the model to retry on failure.
- `src/lib/flows/layout.ts` already auto-positions nodes on canvas, so
  AI-generated nodes wouldn't need manual dragging into place.
- The AI Agents feature already has working provider plumbing
  (`src/lib/ai/generate.ts` + `src/lib/ai/providers/*`) for calling
  OpenAI/Anthropic/DeepSeek/OpenRouter with the account's own key. The
  generator would reuse this rather than building LLM integration from
  scratch.

## What would actually be new work

1. **The schema prompt** — a written description of every node type, its
   required fields, and the connection rules (`next_node_key`,
   `true_next`/`false_next`), detailed enough that the model can't produce
   an invalid shape. This is the "teach it the architecture" piece, and it's
   writing/docs work, not code.
2. **Generate + validate endpoint** — takes the user's plain-English
   description, calls the configured LLM with the schema prompt, runs the
   result through the existing `validate.ts`, and on failure either retries
   with the validation errors fed back to the model, or surfaces them to the
   user.
3. **Bulk create from validated JSON** — reuse the duplicate route's insert
   pattern to write the generated `flows`/`flow_nodes` (or
   `automations`/`automation_steps`) rows in one transaction.
4. **"Describe your flow" entry point in the UI** — a text box that kicks
   off generation and opens the resulting flow already populated on canvas.

## Known hard limit

A node like `send_media` needs a real uploaded file (`media_url` pointing at
actual storage). No LLM can invent that file. Generated flows with a media
step would need to land with that step flagged "needs a file," for the user
to attach manually afterward — same as any other missing asset.

## Suggested order, if we build it

1. Write the schema prompt (docs only).
2. Build generate + validate endpoint, reusing `ai/generate.ts` and
   `flows/validate.ts`.
3. Build bulk-create from validated JSON, reusing the duplicate route's
   insert pattern.
4. Build the UI entry point, wired to the above, with validation errors
   shown back to the user on failure.
5. Stretch: graceful handling of the media-upload gap.
