# Swift Agent 🚀

Swift Agent is a sophisticated AI agent powered by **LangGraph** and the **Model Context Protocol (MCP)**. It is designed to be a versatile assistant capable of executing complex tasks, managing projects, and interacting with databases, all while maintaining a strict safety layer through a human-in-the-loop (HITL) approval system.

## ✨ Key Features

- **LangGraph Orchestration**: Uses a state-driven graph to manage complex agentic workflows.
- **MCP Integration**: Leverages MCP servers to dynamically load and utilize a wide array of tools.
- **Human-in-the-Loop (HITL)**: Sensitive operations (Protected Tools) require explicit user approval. Users can:
    - **Approve**: Allow the tool to run as requested.
    - **Update**: Modify the tool arguments before execution.
    - **Feedback**: Provide guidance to the agent to refine its approach.
    - **Reject**: Block the operation entirely.
- **Database Management**: Capabilities including SQL execution and migration applications.
- **Project Lifecycle**: Tools for creating and deleting projects.

## 🏗️ Architecture

The agent is implemented as a state machine using LangGraph:

1. **`agent_node`**: The core LLM (via Groq/GPT) that decides which tools to call based on the user's request.
2. **`human_review_node`**: A safety gate that intercepts "Protected Tools." It pauses execution using LangGraph's `interrupt` mechanism until a human provides a decision.
3. **`tools_node`**: A specialized node that executes all approved and safe tool calls in parallel.

### Protected Tools
The following tools are marked as protected and will always trigger a human review:
- `create_project`
- `delete_project`
- `execute_sql`
- `apply_migration`

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- [uv](https://github.com/astral-sh/uv) (Recommended package manager)
- API Keys for your LLM provider (e.g., Groq, OpenAI)

### Setup

1. **Clone the Repository**
   ```bash
   git clone <your-repo-url>
   cd swift-agent
   ```

2. **Environment Setup**
   Using `uv` for fast and reliable dependency management:
   ```bash
   uv venv
   uv sync
   uv pip install -e .
   ```

3. **Configuration**
   Create a `.env` file in the root directory and add your required keys:
   ```env
   GROQ_API_KEY=your_api_key_here
   # Add other necessary MCP or Database keys
   ```

4. **Running the Agent**
   You can interact with the agent via the provided frontend scripts in the `frontend/` directory:
   ```bash
   python frontend/chat_local.py
   ```

## 📂 Project Structure

- `swift/`: Core agent logic.
    - `graph.py`: Defines the LangGraph state machine and nodes.
    - `env.py`: Environment and configuration management.
    - `mcp_servers/`: Client implementation and MCP server configurations.
    - `prompts/`: System prompts and specialized instruction sets.
- `frontend/`: Simple chat interfaces for local and deployed versions.
- `static/`: Visual assets and documentation images.
- `pyproject.toml` & `uv.lock`: Python project dependencies and lockfile.

## 🛠️ Tech Stack
- **Framework**: [LangGraph](https://langchain-ai.github.io/langgraph/)
- **LLM**: [Groq](https://groq.com/) / GPT
- **Tooling**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- **Package Management**: [uv](https://github.com/astral-sh/uv)
