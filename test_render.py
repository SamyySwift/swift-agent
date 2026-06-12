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
        "input": {"messages": [{"role": "human", "content": "Here is the titanic data. Please plot the survival rate by gender using the generate_visualization tool. You MUST use the generate_visualization tool! Data: [{'gender': 'male', 'survived': 109, 'total': 577}, {'gender': 'female', 'survived': 233, 'total': 314}]"}]},
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

        if event == "values":
            if "__interrupt__" in data and data["__interrupt__"]:
                print("INTERRUPT REACHED! Resuming...")
                payload = {"command": {"resume": {"action": "continue"}}}
                # We need to break out of this stream and start a new one to resume
                break
    
    # Resume the stream
    print("Resuming stream...")
    async for chunk in client.runs.stream(
        thread_id,
        GRAPH_ID,
        **payload,
        stream_mode=["messages", "values"],
    ):
        event = chunk.event
        data = chunk.data
        if event == "values":
            print(f"RESUMED EVENT: {event}")
            messages = data.get("messages", [])
            print(f"Messages count: {len(messages)}")
            for msg in messages:
                if msg.get("name") == "generate_visualization":
                    print("FOUND VALUES EVENT WITH generate_visualization!")
                    print(f"Content length: {len(msg.get('content', ''))}")
                    print(f"Status: {msg.get('status')}")
                    print(f"ID: {msg.get('id')}")
        elif event == "messages/partial":
            for msg in data:
                print(f"RESUMED PARTIAL Role: {msg.get('role', msg.get('type'))}, Name: {msg.get('name', '')}")
                if msg.get("name") == "generate_visualization":
                    print("FOUND messages/partial WITH generate_visualization!")
                    print(f"ID: {msg.get('id')}")
        else:
            print(f"RESUMED EVENT: {event}")

if __name__ == "__main__":
    asyncio.run(main())
