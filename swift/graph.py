import asyncio
import json
from typing import Annotated, List, Literal, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage, ToolMessage
# from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph, add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import Command, interrupt
from langchain_openai import ChatOpenAI
from swift.mcp_servers.client import get_all_tools
from swift.prompts.prompts import swift_system_prompt as SYSTEM_PROMPT
from swift.tools import generate_visualization

load_dotenv()

PROTECTED_TOOLS = [
    "create_project",
    "delete_project",
    "execute_sql",
    "apply_migration",
]


class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]


# -----------------------
#   BUILD GRAPH
# -----------------------


async def build_graph():

    print("Loading tools...")
    all_tools = await get_all_tools()
    all_tools.append(generate_visualization)

    try:
        print(f"Loaded {len(all_tools)} tools.")
    except Exception as e:
        print(f"Something went wrong while trying to load tools... {e}")

    
    # Instantiate llm with fallback capbility
    fallback_llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        model="nex-agi/nex-n2-pro:free",
        temperature=0.2,
        streaming=True
    ).bind_tools(all_tools, parallel_tool_calls=True)

    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        model="google/gemma-4-31b-it:free",
        streaming=True,
        temperature=0.2,
    ).bind_tools(all_tools, parallel_tool_calls=True).with_fallbacks([fallback_llm])


    async def agent_node(state: AgentState) -> AgentState:
        messages_for_llm = []
        for msg in state["messages"]:
            if getattr(msg, "name", "") == "generate_visualization" and isinstance(msg, ToolMessage):
                messages_for_llm.append(
                    ToolMessage(
                        content="Plot generated and rendered on the frontend successfully. You do not need to output the plot data.",
                        name=msg.name,
                        tool_call_id=msg.tool_call_id
                    )
                )
            else:
                messages_for_llm.append(msg)

        response = await llm.ainvoke(
            [SystemMessage(content=SYSTEM_PROMPT), *messages_for_llm]
        )

        return {"messages": [response]}

    async def human_review_node(
        state: AgentState,
    ) -> Command[Literal["agent_node", "tools_node"]]:
        """This node takes in all the tools and handles interrupt for protected tools"""

        last_message = state["messages"][-1]

        # Defensive check to send control to the agent when it's not either
        # an AI message or tool calls rather than crashing
        if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
            return Command(goto="tools_node")

        protected_calls = [c for c in last_message.tool_calls if c["name"] in PROTECTED_TOOLS]

        safe_calls = [c for c in last_message.tool_calls if c["name"] not in PROTECTED_TOOLS]

        approved_calls: list[dict] = []
        feedback_messages: list[ToolMessage] = []

        # Trigger interrupts for all the protected tools
        for call in protected_calls:

            user_decision: dict = interrupt(
                {
                    "message": f"The agent wants to run {call["name"]}",
                    "tool_call": call,
                    "args": call["args"],
                    "available options": "approve | update {<new args>} | feedback <your feedback> | reject",
                }
            )

            action = user_decision.get("action", "approve")

            if action == "approve":
                approved_calls.append(call)

            # Merge and update call with new args from user
            elif action == "update":
                new_args = user_decision.get("args", {})
                # update tool call
                updated_call = {**call, "args": {**call["args"], **new_args}}
                approved_calls.append(updated_call)

            elif action == "feedback":
                user_feeback = user_decision.get(
                    "message", "The user provided a feedback to this call"
                )
                # update the Tool Message with review so the AI agent adjusts accordinly
                feedback_messages.append(
                    ToolMessage(
                        content=user_feeback, name=call["name"], tool_call_id=call["id"]
                    )
                )

            elif action == "reject":
                feedback_messages.append(
                    ToolMessage(
                        content="The user rejected this tool call. Ask them how you should proceed with this call",
                        name=call["name"],
                        tool_call_id=call["id"],
                    )
                )

        # ----------------Determin where to go next ------------------

        calls_to_run = [*approved_calls, *safe_calls]
        # Rebuild the AIMessage so tool calls match tool results
        updated_ai_message = AIMessage(
            content=last_message.content, tool_calls=calls_to_run, id=last_message.id
        )

        # There are tools, go to tools node and run them
        # Attach the feedback messages so the agent sees them once the tool run finishes
        if calls_to_run:
            return Command(
                goto="tools_node",
                update={"messages": [updated_ai_message, *feedback_messages]},
            )

        else:
            # Everthing tool was rejected/feedbacked. Go back to agent.else
            # Go back to agent node with the feeback, so it can respond and adjust accordingly

            return Command(
                goto="agent_node",
                update={"messages": [updated_ai_message, *feedback_messages]},
            )

    async def should_continue(state: AgentState) -> str:

        last_message = state["messages"][-1]

        if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
            return END

        # Send any protected_tools to human review node
        if any(c["name"] in PROTECTED_TOOLS for c in last_message.tool_calls):
            return "human_review_node"

        # All safe, run tools
        return "tools_node"

    # ── NODE 3: tools_node ─────────────────────────────────────────
    # ToolNode runs all approved tool calls in parallel and handles
    # errors per-tool, returning ToolMessage(status="error") on failure
    # so the agent can recover gracefully.
    def handle_tool_error(error: Exception) -> str:
        return json.dumps({"status": "error", "error": str(error)})

    tools_node = ToolNode(all_tools, handle_tool_errors=handle_tool_error)

    # ===========================
    #       WIRING THE GRPAH
    # ===========================

    # Adding nodes
    builder = StateGraph(AgentState)
    builder.add_node("agent_node", agent_node)
    builder.add_node("tools_node", tools_node)
    builder.add_node("human_review_node", human_review_node)

    # Add edges
    builder.add_edge(START, "agent_node")
    builder.add_conditional_edges(
        "agent_node",
        should_continue,
        {
            END: END,
            "human_review_node": "human_review_node",
            "tools_node": "tools_node",
        },
    )

    builder.add_edge("tools_node", "agent_node")

    graph = builder.compile()

    return graph


graph = asyncio.run(build_graph())
graph.get_graph().draw_mermaid_png(output_file_path="./static/graph.png")
