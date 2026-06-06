import asyncio
import json
import uuid
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.types import Command

from swift.graph import build_graph

load_dotenv()


# ─────────────────────────────────────────────────────────────────
# STREAMING RUNNER
# ─────────────────────────────────────────────────────────────────


async def run(user_message: str, graph, config: dict):
    """
    Run one conversation turn.
    Streams AI tokens, tool call names/args, and tool results live.
    Pauses on interrupts and collects human decisions before resuming.
    """
    current_input: Any = {"messages": [HumanMessage(content=user_message)]}

    while True:
        interrupt_payload = None
        in_ai_stream = False

        async for chunk in graph.astream(
            current_input,
            config=config,
            stream_mode=["messages", "updates", "values"],
            version="v2",
        ):
            ctype = chunk.get("type")

            if ctype == "messages":
                msg, _meta = chunk["data"]

                # Stream AI text tokens as they arrive
                if isinstance(msg, AIMessage) and msg.content:
                    if not in_ai_stream:
                        print("\n🤖 Assistant: ", end="", flush=True)
                        in_ai_stream = True
                    print(msg.content, end="", flush=True)

                # Stream tool call name + args as the LLM generates them
                if isinstance(msg, AIMessage) and msg.tool_call_chunks:
                    for tc in msg.tool_call_chunks:
                        if tc.get("name"):
                            print(
                                f"\n⚙️  Calling: \033[93m{tc['name']}\033[0m ",
                                end="",
                                flush=True,
                            )
                        if tc.get("args"):
                            print(f"\033[2m{tc['args']}\033[0m", end="", flush=True)

                # Print tool results
                if isinstance(msg, ToolMessage):
                    if in_ai_stream:
                        print()
                        in_ai_stream = False
                    try:
                        pretty = json.dumps(json.loads(msg.content), indent=2)
                    except Exception:
                        pretty = msg.content
                    print(f"\n🔧 Tool result:\n\033[2m{pretty}\033[0m")

            elif ctype == "values":
                interrupts = chunk.get("interrupts", [])
                if interrupts:
                    interrupt_payload = interrupts[0]

        if in_ai_stream:
            print()

        # ── Human review prompt ────────────────────────────────────
        if interrupt_payload is not None:
            payload = interrupt_payload.value
            call = payload["tool_call"]
            args = call["args"]
            args_json = json.dumps(args, indent=2)
            one_liner = json.dumps(args)

            print("\n" + "═" * 60)
            print(f"  🛡  {payload['message']}")
            print("─" * 60)
            print("  Current args (copy & edit for update):")
            for line in args_json.splitlines():
                print(f"    {line}")
            print("─" * 60)
            print("  continue              → run as-is")
            print("  reject                → cancel, tell agent")
            print("  feedback <message>    → skip + tell agent why")
            print()
            print("  To update args, copy the JSON above, change what")
            print("  you need, then type:  update <edited JSON>")
            print()
            print(f"  Example: update {one_liner}")
            print("═" * 60)

            raw = input("\n  Decision › ").strip()
            lower = raw.lower()

            if lower in ("approve", ""):
                decision = {"action": "approve"}

            elif lower.startswith("update"):
                rest = raw[6:].strip()
                try:
                    new_args = json.loads(rest)
                except json.JSONDecodeError:
                    print("  ⚠ Couldn't parse JSON — running as-is")
                    new_args = {}
                decision = {"action": "update", "args": new_args}

            elif lower.startswith("feedback"):
                decision = {"action": "feedback", "message": raw[8:].strip()}

            elif lower == "reject":
                decision = {"action": "reject"}

            else:
                print("  ⚠ Unknown input — defaulting to continue")
                decision = {"action": "continue"}

            current_input = Command(resume=decision)

        else:
            break


async def main():
    print("""
╔══════════════════════════════════════════════════════╗
║          🗄  Supabase Agent                          ║
╚══════════════════════════════════════════════════════╝

Safe tools run automatically.
Protected tools (create/delete/execute_sql) pause for review.
Type 'exit' to quit. Type 'yolo' to toggle auto-approve.
""")
    print("  Connecting to Supabase MCP server...")
    graph = await build_graph()
    config = {"configurable": {"thread_id": f"t-{uuid.uuid4().hex[:6]}"}}
    yolo = False
    print("  Ready!\n")

    while True:
        user_input = input("You: ").strip()

        if not user_input:
            continue

        if user_input.lower() == "exit":
            print("Bye!")
            break

        await run(user_input, graph, config)


if __name__ == "__main__":
    asyncio.run(main())
