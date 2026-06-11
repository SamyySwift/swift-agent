import os

# Get the directory where this __init__.py file is located
module_dir = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(module_dir, "swift.md"), "r") as f:
    swift_system_prompt = f.read()
