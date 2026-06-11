import asyncio
import json
import os
import sys

from langgraph_sdk import get_client

async def main():
    BASE_URL = "https://swift-agent-2ywt.onrender.com"
    GRAPH_ID = "swift"
    client = get_client(url=BASE_URL)
    thread = await client.threads.create()
    thread_id = thread["thread_id"]

    print(f"Thread ID: {thread_id}")

    payload = {
        "input": {"messages": [{"role": "human", "content": "Query titanic and plot survival rate by gender"}]},
    }

    async for chunk in client.runs.stream(
        thread_id,
        GRAPH_ID,
        **payload,
        stream_mode=["messages", "values"],
    ):
        event = chunk.event
        data = chunk.data
        if event == "values":
            messages = data.get("messages", [])
            for msg in messages:
                if msg.get("name") == "generate_visualization":
                    print("FOUND VALUES EVENT WITH generate_visualization!")
                    print(f"Content length: {len(msg.get('content', ''))}")
                    print(f"Status: {msg.get('status')}")
                    print(f"ID: {msg.get('id')}")

        if event == "messages/partial":
            for msg in data:
                print(f"Role: {msg.get('role', msg.get('type'))}, Name: {msg.get('name', '')}, ToolCalls: {msg.get('tool_calls', [])}")
                if msg.get("name") == "generate_visualization":
                    print("FOUND messages/partial WITH generate_visualization!")
                    print(f"ID: {msg.get('id')}")

        if event == "values":
            if "__interrupt__" in data:
                print("INTERRUPT REACHED!")
                break

if __name__ == "__main__":
    asyncio.run(main())
