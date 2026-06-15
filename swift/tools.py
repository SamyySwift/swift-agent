import traceback
import re
from langchain_core.tools import tool
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

def clean_python_code(code: str) -> str:
    """Remove markdown code blocks if the model hallucinates them."""
    code = code.strip()
    if code.startswith("```"):
        # Strip the first line (e.g. ```python) and the last line (e.g. ```)
        lines = code.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        code = "\n".join(lines)
    return code

@tool
def generate_visualization(python_code: str) -> str:
    """
    Generate a Plotly visualization by executing Python code.
    The code MUST assign a Plotly Figure object to a global variable named 'fig'.
    You can use pandas (as pd), plotly.express (as px), and plotly.graph_objects (as go) in your code.
    Returns the JSON representation of the figure or an error message.
    """
    python_code = clean_python_code(python_code)
    
    local_vars = {
        'pd': pd,
        'px': px,
        'go': go
    }
    
    # Pre-inject numpy if available, as models frequently use it
    try:
        import numpy as np
        local_vars['np'] = np
    except ImportError:
        pass

    try:
        exec(python_code, globals(), local_vars)
        
        # Try to find 'fig' first
        fig = local_vars.get('fig')
        
        # If 'fig' is not found, search for any Plotly Figure in the local scope
        if fig is None:
            for val in local_vars.values():
                if isinstance(val, go.Figure):
                    fig = val
                    break
                    
        if fig is not None:
            # Return the JSON string so the agent can embed it in a markdown block
            return fig.to_json()
        else:
            return "Error: A Plotly figure was not generated. Please assign your plot to the variable 'fig'."
    except Exception as e:
        return f"Error executing code: {traceback.format_exc()}"
