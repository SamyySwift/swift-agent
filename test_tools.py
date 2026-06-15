import asyncio
from swift.tools import generate_visualization

def test_visualization():
    # Test 1: Code with markdown blocks
    print("Test 1: Markdown blocks")
    code_with_md = """```python
import plotly.express as px
import pandas as pd

df = pd.DataFrame({'x': [1, 2], 'y': [3, 4]})
fig = px.bar(df, x='x', y='y')
```"""
    res1 = generate_visualization.invoke({"python_code": code_with_md})
    if res1.startswith("{"):
        print("Test 1 PASSED: valid JSON")
    else:
        print("Test 1 FAILED:", res1)

    # Test 2: Forgot fig variable name (using my_chart)
    print("Test 2: Forgot 'fig' variable")
    code_wrong_var = """
import plotly.express as px
import pandas as pd

df = pd.DataFrame({'a': [1, 2], 'b': [3, 4]})
my_chart = px.scatter(df, x='a', y='b')
"""
    res2 = generate_visualization.invoke({"python_code": code_wrong_var})
    if res2.startswith("{"):
        print("Test 2 PASSED: valid JSON")
    else:
        print("Test 2 FAILED:", res2)

    # Test 3: Actual error scenario
    print("Test 3: Syntax error")
    code_syntax_error = "import not_a_library"
    res3 = generate_visualization.invoke({"python_code": code_syntax_error})
    if res3.startswith("Error"):
        print("Test 3 PASSED: Returned error string:", res3.split("\n")[0])
    else:
        print("Test 3 FAILED:", res3)

if __name__ == "__main__":
    test_visualization()
