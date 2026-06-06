from typing import Annotated, AsyncGenerator, Generator, List, TypedDict

from langchain.tools import BaseTool
from langchain_core.messages import (
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompts.chat import MessagesPlaceholder
from langchain_groq import ChatGroq
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel


class SwiftState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]


class Agent:
    """
    Agent class for implementing Langgraph agents.

    Attributes:
        tools: The tools available to the agent.
        model: The model to use for the agent.
        system_prompt: The system prompt for the agent.
        temperature: The temperature for the agent.
    """

    def __init__(
        self,
        tools: List,
        model: str = "openai/gpt-oss-20b",
        system_prompt: str = "You are a helpful assistant.",
        temperature: float = 0.5,
    ):
        self.tools = tools
        self.model = model
        self.system_prompt = system_prompt
        self.temperature = temperature

        self.prompt_template = ChatPromptTemplate.from_messages(
            [
                ("system", self.system_prompt),
                MessagesPlaceholder(variable_name="messages"),
            ]
        ).partial(tools=self.tools)

        self.agent = self.prompt_template | ChatGroq(
            model=self.model, temperature=self.temperature
        ).bind_tools(self.tools)

        self.runnable = self.build_graph()

    def __str__(self):
        return f"This is the modifed prompt: {self.prompt_template}"

    def build_graph(self):
        """
        Build the LangGraph application.
        """

        def Swift_node(state: SwiftState) -> SwiftState:
            response = self.agent.invoke({"messages": state["messages"]})
            return {"messages": [response]}

        def router(state: SwiftState) -> str:
            last_message = state["messages"][-1]
            if getattr(last_message, "tool_calls", None):
                return "tools"
            else:
                return END

        builder = StateGraph(SwiftState)

        builder.add_node("chatbot", Swift_node)
        builder.add_node("tools", ToolNode(self.tools))

        builder.add_edge(START, "chatbot")
        builder.add_conditional_edges("chatbot", router, ["tools", END])
        builder.add_edge("tools", "chatbot")

        return builder.compile(checkpointer=MemorySaver())

    def inspect_graph(self):
        """
        Visualize the graph using the mermaid.ink API.
        """
        from IPython.display import Image, display

        graph = self.build_graph()

    async def stream(self, message: SwiftState, **kwargs) -> AsyncGenerator[str, None]:
        """Synchronously stream the results of the graph run.

        Args:
            message: The user message.

        Returns:
            str: The final LLM response or tool call response
        """
        async for message_chunk, metadata in self.runnable.astream(
            message, stream_mode="messages", **kwargs
        ):
            if isinstance(message_chunk, AIMessageChunk):
                # print(message_chunk)
                if message_chunk.response_metadata:
                    finish_reason = message_chunk.response_metadata.get(
                        "finish_reason", ""
                    )
                    if finish_reason == "tool_calls":
                        yield "\n\n"

                if message_chunk.tool_call_chunks:
                    tool_chunk = message_chunk.tool_call_chunks[0]

                    tool_name = tool_chunk.get("name", "")
                    args = tool_chunk.get("args", "")

                    if tool_name:
                        yield f"\n\n< TOOL CALL: {tool_name} >\n\n"

                    if args:
                        yield args
                else:
                    yield message_chunk.content
