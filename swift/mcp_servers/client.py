import json
import os
from langchain_mcp_adapters.client import MultiServerMCPClient
from swift.env import SUPABASE_ACCESS_TOKEN


async def get_all_tools():
    config_path = os.path.join(os.path.dirname(__file__), "mcp_config.json")
    with open(config_path, "r") as f:
        config = json.load(f)

    
    config["supabase"]["args"] = [arg if arg != "SUPABASE_ACCESS_TOKEN" else SUPABASE_ACCESS_TOKEN for arg in config["supabase"]["args"]]

    client = MultiServerMCPClient(config)

    tools = await client.get_tools()

    return tools
