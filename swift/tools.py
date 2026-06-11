import traceback
from langchain_core.tools import tool
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

@tool
def generate_visualization(python_code: str) -> str:
    """
    Generate a Plotly visualization by executing Python code.
    The code MUST assign a Plotly Figure object to a global variable named 'fig'.
    You can use pandas (as pd), plotly.express (as px), and plotly.graph_objects (as go) in your code.
    Returns the JSON representation of the figure or an error message.
    """
    local_vars = {
        'pd': pd,
        'px': px,
        'go': go
    }
    try:
        exec(python_code, globals(), local_vars)
        if 'fig' in local_vars:
            fig = local_vars['fig']
            # Return the JSON string so the agent can embed it in a markdown block
            return fig.to_json()
        else:
            return "Error: The variable 'fig' was not defined in the code."
    except Exception as e:
        return f"Error executing code: {traceback.format_exc()}"
