# Capture Test — 8x assignment

Verification that every Claude Code prompt and final response in this repo is captured to `.agent-logs/`.

**Result: passed** — two canary prompts, sent in two separate sessions, were each logged with their prompt and final response.

## Mechanism

Claude Code hooks, configured in the project (committed, so they apply to anyone running `claude` in this repo):

| File | Role |
|---|---|
| `.claude/settings.json` | Registers three hooks, each running `python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/capture.py" <mode>` |
| `.claude/hooks/capture.py` | The capture script (stdlib Python 3, no dependencies) |

| Hook event | Mode | What it does |
|---|---|---|
| `SessionStart` | `session` | Records the session's model, if the client provides it |
| `UserPromptSubmit` | `prompt` | Appends a `PROMPT` entry with the prompt text verbatim, a UTC timestamp and the model |
| `Stop` | `stop` | Appends a `RESPONSE` entry with the final text of the turn. Uses `last_assistant_message` from the Stop event; falls back to reading the session transcript |

Properties:

- **Append-only.** Only the YAML frontmatter (counters, timestamps, model list) is rewritten.
- **Never blocks the session.** Errors go to `.claude/hooks/.state/errors.log` and the hook exits 0.
- **Per-session state** (entry count, log file path) lives in `.claude/hooks/.state/`, which is gitignored.

## Log path

```
.agent-logs/<YYYY-MM-DD_HH-MM-SS of first prompt, UTC>_<session_id>.md
```

One file per session, with frontmatter `session_id`, `date`, `author`, `model`, `tool`, `project`, `total_exchanges`, `first_prompt_time`, `last_prompt_time`.

## Canary 1 — session `bf7816a6`

File: `.agent-logs/2026-09-28_19-51-55_bf7816a6-0789-4b44-8776-7b34efdd55d9.md`

```
[LOG_ENTRY type=PROMPT num=1 session=bf7816a6]
timestamp: 2026-09-28T19:51:55.491Z
model: claude-opus-5-5

CAPTURE TEST — 8x assignment, Wajeiha


[LOG_ENTRY type=RESPONSE num=1 session=bf7816a6]
timestamp: 2026-09-28T19:52:06.041Z
model: claude-opus-5-5

The canary prompt was captured in this session. The hook picked up the new settings without a restart. It landed in:

`.agent-logs/2026-09-28_19-51-55_bf7816a6-0789-4b44-8776-7b34efdd55d9.md`

- **Prompt entry:** there, as `PROMPT num=1`, with the exact text, a UTC timestamp and the model `claude-opus-5-5`.
- **Response entry:** this reply is the response. The `Stop` hook adds it as `RESPONSE num=1` when this turn ends, so I can only confirm it on the next turn.
- **Errors:** none; `errors.log` is empty.

Next, open a **new session** (exit, run `claude` in this repo) and send `CAPTURE TEST — 8x assignment, Wajeiha (session 2)`. Then tell me it's done, in either session. I'll check that both canaries have their prompt and response, write `CAPTURE-TEST.md` with the raw entries, and commit it with the logs.
```

## Canary 2 — session `af13b405`

File: `.agent-logs/2026-09-28_19-56-48_af13b405-73a8-4316-91af-d81964998b67.md`

```
[LOG_ENTRY type=PROMPT num=1 session=af13b405]
timestamp: 2026-09-28T19:56:48.144Z
model: claude-opus-5-5

CAPTURE TEST — 8x assignment, Wajeiha


[LOG_ENTRY type=RESPONSE num=1 session=af13b405]
timestamp: 2026-09-28T19:56:53.076Z
model: claude-opus-5-5

Got your capture test. Nothing needed from me beyond a reply, so this response should be logged as the final response.

To check the hooks recorded both sides, look at the newest file in `.agent-logs/` after this turn ends. It should contain your prompt ("CAPTURE TEST — 8x assignment, Wajeiha") and this reply.
```

Both responses were taken from the Stop event's `last_assistant_message` (state field `last_response_source: stop_input`), not the transcript fallback. `errors.log` was never created.

## Limitations and issues from the initial setup

1. **First attempt at canary 2 left no trace.** In session `bf7816a6` (prompt 2, 19:54Z) the second canary was reported as sent, but no second session existed on the machine: no log, no hook state, no Claude Code transcript. The prompt most likely never reached Claude Code in this repo. The retry at 19:56Z (session `af13b405`) was captured. Its text omitted the suggested "(session 2)" suffix, so the two canary prompts are identical and are told apart by session id.
2. **Model can be `unknown` on the first prompt.** In the VS Code extension, `SessionStart` did not include the model, and on the first prompt of a session there is no earlier assistant message in the transcript to read it from. Session `b40be146` therefore logged `model: unknown` on `PROMPT num=1` and, before the fix, `model: unknown, claude-opus-5-5` in its header.
   - **Fix (this commit):** `unknown` is now only a placeholder. `note_model` drops it once a real model is seen, and the header never lists it next to a real model. The header is rewritten on every entry, so it self-corrects after the first response.
   - **Remaining limitation:** the `model:` line inside an already-written first `PROMPT` entry stays `unknown`, because entries are append-only and the model genuinely was not known at that moment. The `RESPONSE` entry for the same turn records the real model.
3. **Sessions with no prompts leave only a state file.** Two sessions (`832ed36e`, `af9fbfb8`) were opened without sending a prompt. `SessionStart` wrote a state file, but no log was created, which is intended: logs start at the first prompt.
4. **Hooks capture final text only.** Tool calls, tool results and intermediate text between tool calls are not logged; each `RESPONSE` entry is the final assistant text of the turn.
