"""
LangGraph Deployed Agent Client
=================================

Interacts with your deployed graph at https://swift-agent-h60g.onrender.com
using the langgraph_sdk.

Flow:
  1. Create a thread  (once per conversation)
  2. Stream a run     (once per message)
  3. If interrupted   → show the user what needs approval
  4. Resume the run   → Command(resume=decision) on the same thread
  5. Loop until no more interrupts

Install:
    pip install langgraph-sdk python-dotenv

Usage:
    python client.py
    python client.py "list all my supabase projects"
"""

import asyncio
import json
import os
import sys
from typing import Any

from dotenv import load_dotenv
from langgraph_sdk import get_client

load_dotenv()

# ─────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────

BASE_URL  = os.environ.get("LANGGRAPH_BASE_URL", "https://swift-agent-h60g.onrender.com")
API_KEY   = os.environ.get("LANGGRAPH_API_KEY", "")    # set if your deployment requires auth
GRAPH_ID  = os.environ.get("LANGGRAPH_GRAPH_ID", "swift")  # the graph name you deployed

# ─────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────

def print_separator(char="─", width=60):
    print(char * width)

def pretty_json(text: str) -> str:
    try:
        return json.dumps(json.loads(text), indent=2)
    except Exception:
        return text


# ─────────────────────────────────────────────────────────────────
# STREAM HANDLER
#
# Processes SSE chunks from the LangGraph server.
# The server emits events with these types:
#
#   metadata      → run_id, graph_id (first event)
#   messages/complete  → full messages list after a node completes
#   messages/partial   → streaming token chunks from the LLM
#   updates       → state patch after each node
#   values        → full state snapshot; interrupt payloads are here
#   error         → something went wrong
#   end           → stream is done
# ─────────────────────────────────────────────────────────────────

async def stream_and_handle(client, thread_id: str, payload: dict) -> dict | None:
    """
    Stream one run. Returns the interrupt payload if one is found, else None.

    payload is either:
      {"input": {"messages": [...]}} for a new message
      {"command": {"resume": ...}}   for resuming after an interrupt
    """
    interrupt_payload = None
    in_ai_stream      = False
    seen_tool_calls   = set()   # avoid printing the same tool call twice
    printed_text      = ""      # track how much AI text we've already printed
                                # because messages/partial sends the full
                                # accumulated text each time, not just the delta

    async for chunk in client.runs.stream(
        thread_id,
        GRAPH_ID,
        **payload,
        stream_mode=["messages", "values"],
    ):
        event = chunk.event   # e.g. "messages/partial", "values", "error"
        data  = chunk.data

        # ── Token-by-token AI text ─────────────────────────────────
        if event == "messages/partial":
            for msg in data:
                role    = msg.get("type") or msg.get("role", "")
                content = msg.get("content", "")

                # AI text tokens
                if role == "ai" and content:
                    # Normalise content to a plain string
                    if isinstance(content, list):
                        full_text = "".join(
                            block.get("text", "")
                            for block in content
                            if isinstance(block, dict) and block.get("type") == "text"
                        )
                    else:
                        full_text = content if isinstance(content, str) else ""

                    # Only print the NEW characters since last chunk
                    delta = full_text[len(printed_text):]
                    if delta:
                        if not in_ai_stream:
                            print("\n🤖 Assistant: ", end="", flush=True)
                            in_ai_stream = True
                        print(delta, end="", flush=True)
                        printed_text = full_text

                # Stream tool call name + args as they build up
                for tc in msg.get("tool_calls", []):
                    tc_id   = tc.get("id", "")
                    tc_name = tc.get("name", "")
                    tc_args = tc.get("args", {})
                    if tc_id and tc_id not in seen_tool_calls and tc_name:
                        seen_tool_calls.add(tc_id)
                        args_str = json.dumps(tc_args) if tc_args else "..."
                        print(f"\n⚙️  Calling: \033[93m{tc_name}\033[0m \033[2m{args_str}\033[0m",
                              flush=True)

                # Tool results
                if role == "tool":
                    if in_ai_stream:
                        print()
                        in_ai_stream = False
                    printed_text = ""   # reset for the next AI message
                    tool_name = msg.get("name", "tool")
                    is_error  = msg.get("status") == "error"
                    raw       = content if isinstance(content, str) else json.dumps(content)

                    if is_error:
                        try:
                            err_data = json.loads(raw)
                            err_msg  = (
                                err_data.get("error", {}).get("message")
                                or err_data.get("error")
                                or raw
                            )
                        except Exception:
                            err_msg = raw
                        print(f"\n❌ Tool error ({tool_name}):\n   \033[91m{err_msg}\033[0m")
                    else:
                        print(f"\n🔧 Tool result ({tool_name}):\n\033[2m{pretty_json(raw)}\033[0m")

        # ── Full state snapshot — interrupt payloads live here ─────
        elif event == "values":
            if in_ai_stream:
                print()
                in_ai_stream = False
            interrupts = data.get("__interrupt__", []) if isinstance(data, dict) else []
            if interrupts:
                interrupt_payload = interrupts[0]

        # ── Errors ─────────────────────────────────────────────────
        elif event == "error":
            if in_ai_stream:
                print()
                in_ai_stream = False
            print(f"\n\033[91m⚠️  Server error: {data}\033[0m")

    if in_ai_stream:
        print()

    return interrupt_payload


# ─────────────────────────────────────────────────────────────────
# INTERRUPT PROMPT
# ─────────────────────────────────────────────────────────────────

def collect_decision(interrupt_payload: dict) -> dict:
    """Display the interrupt and collect the human's decision."""
    value    = interrupt_payload.get("value", interrupt_payload)
    call     = value.get("tool_call", {})
    args     = call.get("args", value.get("args", {}))
    message  = value.get("message", f"Agent wants to call '{call.get('name', 'a tool')}'")
    args_json = json.dumps(args, indent=2)
    one_liner = json.dumps(args)

    print("\n" + "═"*60)
    print(f"  🛡  {message}")
    print_separator()
    print("  Current args (copy & edit for update):")
    for line in args_json.splitlines():
        print(f"    {line}")
    print_separator()
    print("  continue              → run as-is")
    print("  reject                → cancel, tell agent")
    print("  feedback <message>    → skip + tell agent why")
    print()
    print("  To update args, type:  update <edited JSON>")
    print(f"  Example: update {one_liner}")
    print("═"*60)

    raw   = input("\n  Decision › ").strip()
    lower = raw.lower()

    if lower in ("continue", ""):
        return {"action": "continue"}
    elif lower.startswith("update"):
        rest = raw[6:].strip()
        try:
            new_args = json.loads(rest)
        except json.JSONDecodeError:
            print("  ⚠ Couldn't parse JSON — running as-is")
            new_args = {}
        return {"action": "update", "args": new_args}
    elif lower.startswith("feedback"):
        return {"action": "feedback", "message": raw[8:].strip()}
    elif lower == "reject":
        return {"action": "reject"}
    else:
        print("  ⚠ Unknown input — defaulting to continue")
        return {"action": "continue"}


# ─────────────────────────────────────────────────────────────────
# MAIN TURN
#
# One "turn" = one user message on a thread.
# Handles as many sequential interrupts as needed before finishing.
# ─────────────────────────────────────────────────────────────────

async def run_turn(client, thread_id: str, user_message: str):
    # First pass: send the user message
    payload: dict[str, Any] = {
        "input": {"messages": [{"role": "human", "content": user_message}]},
    }

    while True:
        interrupt_payload = await stream_and_handle(client, thread_id, payload)

        if interrupt_payload is not None:
            # Collect the human decision and resume
            decision = collect_decision(interrupt_payload)
            payload  = {"command": {"resume": decision}}
        else:
            # No interrupt — turn is complete
            break


# ─────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────

async def main():
    # Single message mode: python client.py "your question"
    single_message = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else None

    print("""
╔══════════════════════════════════════════════════════╗
║          🗄  Supabase Agent Client                   ║
║          Connected to LangGraph Server               ║
╚══════════════════════════════════════════════════════╝
""")
    print(f"  Server:  {BASE_URL}")
    print(f"  Graph:   {GRAPH_ID}\n")

    # Build the SDK client
    client_kwargs = {"url": BASE_URL}
    if API_KEY:
        client_kwargs["api_key"] = API_KEY
    client = get_client(**client_kwargs)

    # Create a thread — one thread per conversation session
    # Reuse the same thread across turns to maintain memory
    thread = await client.threads.create()
    thread_id = thread["thread_id"]
    print(f"  Thread:  {thread_id}\n")

    if single_message:
        # Single-shot mode
        await run_turn(client, thread_id, single_message)
        return

    # Interactive REPL
    print("  Type your message, or 'exit' to quit.\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break

        if not user_input:
            continue
        if user_input.lower() == "exit":
            print("Bye!")
            break

        await run_turn(client, thread_id, user_input)


if __name__ == "__main__":
    asyncio.run(main())