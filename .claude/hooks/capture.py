#!/usr/bin/env python3
"""Claude Code capture hook: logs each prompt and final response to .agent-logs/.

Wired in .claude/settings.json:
  SessionStart      -> capture.py session   (records the session's model)
  UserPromptSubmit  -> capture.py prompt    (appends the PROMPT entry, verbatim)
  Stop              -> capture.py stop      (appends the RESPONSE entry: final text of the turn)

Append-only. Only the frontmatter counters are rewritten. Never blocks the session:
every error goes to .claude/hooks/.state/errors.log and the script exits 0.
"""
import datetime as dt
import glob
import json
import os
import sys
import time
import traceback

AUTHOR = "wajeihaburhan"
TOOL = "claude-code"
PROJECT = "higgsfield-8x-assignment"

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG_DIR = os.path.join(ROOT, ".agent-logs")
STATE_DIR = os.path.join(ROOT, ".claude", "hooks", ".state")


def now_iso():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def load_state(sid):
    try:
        with open(os.path.join(STATE_DIR, sid + ".json")) as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(sid, st):
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(os.path.join(STATE_DIR, sid + ".json"), "w") as f:
        json.dump(st, f, indent=2)


def read_transcript(path):
    out = []
    try:
        with open(path) as f:
            for line in f:
                try:
                    out.append(json.loads(line))
                except Exception:
                    pass
    except Exception:
        pass
    return out


def last_model(entries):
    for e in reversed(entries):
        m = e.get("message")
        if e.get("type") == "assistant" and isinstance(m, dict) and m.get("model"):
            if m["model"] != "<synthetic>":
                return m["model"]
    return None


def final_response(entries):
    """Text blocks of the assistant messages after the last user/tool_result entry."""
    texts, ts, model = [], None, None
    for e in reversed(entries):
        t = e.get("type")
        if t == "user" and not e.get("isSidechain"):
            break
        if t != "assistant" or e.get("isSidechain"):
            continue
        m = e.get("message") or {}
        blocks = m.get("content")
        if isinstance(blocks, str):
            blocks = [{"type": "text", "text": blocks}]
        for b in reversed(blocks or []):
            if isinstance(b, dict) and b.get("type") == "text" and b.get("text"):
                texts.append(b["text"])
        ts = ts or e.get("timestamp")
        model = model or m.get("model")
    return "\n\n".join(reversed(texts)), ts, model


def log_path(sid, st):
    if st.get("log_file") and os.path.exists(st["log_file"]):
        return st["log_file"]
    hits = glob.glob(os.path.join(LOG_DIR, "*_%s.md" % sid))
    return hits[0] if hits else None


def write_header(path, sid, st):
    models = ", ".join(st.get("models") or ["unknown"])
    header = (
        "---\n"
        f"session_id: {sid}\n"
        f"date: {st['first_prompt_time'][:10]}\n"
        f"author: {AUTHOR}\n"
        f"model: {models}\n"
        f"tool: {TOOL}\n"
        f"project: {PROJECT}\n"
        f"total_exchanges: {st.get('count', 0)}\n"
        f"first_prompt_time: {st['first_prompt_time']}\n"
        f"last_prompt_time: {st['last_prompt_time']}\n"
        "---\n"
    )
    body = ""
    if os.path.exists(path):
        with open(path) as f:
            content = f.read()
        if content.startswith("---\n"):
            end = content.find("\n---\n", 4)
            body = content[end + 5:] if end != -1 else content
        else:
            body = content
    else:
        body = (
            f"\n# Session Log - {st['first_prompt_time'][:10]}\n\n"
            f"Session: `{sid[:8]}` | Project: `{PROJECT}` | Author: `{AUTHOR}`\n\n---\n"
        )
    with open(path, "w") as f:
        f.write(header + body)


def append(path, text):
    with open(path, "a") as f:
        f.write(text)


def note_model(st, model):
    if model:
        st.setdefault("models", [])
        if model not in st["models"]:
            st["models"].append(model)
        st["current_model"] = model


def on_session(data):
    sid = data["session_id"]
    st = load_state(sid)
    model = data.get("model")
    if isinstance(model, dict):
        model = model.get("id") or model.get("display_name")
    if model:
        st["current_model"] = model
    save_state(sid, st)


def on_prompt(data):
    sid = data["session_id"]
    st = load_state(sid)
    ts = now_iso()
    model = (last_model(read_transcript(data.get("transcript_path", "")))
             or st.get("current_model") or "unknown")
    note_model(st, model)
    st["count"] = st.get("count", 0) + 1
    st.setdefault("first_prompt_time", ts)
    st["last_prompt_time"] = ts
    st["pending_prompt_time"] = ts

    os.makedirs(LOG_DIR, exist_ok=True)
    path = log_path(sid, st)
    if not path:
        stamp = ts[:19].replace("T", "_").replace(":", "-")
        path = os.path.join(LOG_DIR, f"{stamp}_{sid}.md")
    st["log_file"] = path
    write_header(path, sid, st)
    append(path, (
        f"\n[LOG_ENTRY type=PROMPT num={st['count']} session={sid[:8]}]\n"
        f"timestamp: {ts}\n"
        f"model: {model}\n\n"
        f"{data.get('prompt', '')}\n\n"
    ))
    save_state(sid, st)


def on_stop(data):
    sid = data["session_id"]
    st = load_state(sid)
    path = log_path(sid, st)
    if not path or st.get("responded_to") == st.get("count"):
        return  # no prompt logged for this turn, or already answered
    st["last_stop_input_keys"] = sorted(data.keys())
    text, ts, model = "", None, None
    if isinstance(data.get("last_assistant_message"), str) and data["last_assistant_message"].strip():
        # Newer Claude Code passes the final message directly on the Stop event.
        text = data["last_assistant_message"]
        model = last_model(read_transcript(data.get("transcript_path", "")))
        st["last_response_source"] = "stop_input"
    else:
        # Fall back to the transcript, which can lag the Stop event slightly; retry.
        for _ in range(20):
            text, ts, model = final_response(read_transcript(data.get("transcript_path", "")))
            if text and ts and ts >= st.get("pending_prompt_time", ""):
                break
            time.sleep(0.25)
        st["last_response_source"] = "transcript"
    if not text:
        text = "(no text response captured for this turn)"
    model = model or st.get("current_model") or "unknown"
    note_model(st, model)
    st["responded_to"] = st.get("count")
    write_header(path, sid, st)
    append(path, (
        f"\n[LOG_ENTRY type=RESPONSE num={st['count']} session={sid[:8]}]\n"
        f"timestamp: {now_iso()}\n"
        f"model: {model}\n\n"
        f"{text}\n\n"
    ))
    save_state(sid, st)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        data = json.load(sys.stdin)
        {"session": on_session, "prompt": on_prompt, "stop": on_stop}[mode](data)
    except Exception:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(os.path.join(STATE_DIR, "errors.log"), "a") as f:
            f.write(f"{now_iso()} mode={mode}\n{traceback.format_exc()}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
