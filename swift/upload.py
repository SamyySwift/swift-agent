"""
Upload Router
=============
Accepts CSV / Excel file uploads, parses them with pandas, and loads them into
the existing Supabase Postgres as a session-scoped table.

Table naming convention:
    upload_<thread_id[:8]>_<sanitized_filename>

Returns JSON with:
    table_name, columns, row_count, preview (first 5 rows)
"""

import io
import os
import re

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import create_engine, text

router = APIRouter()

# ── DB connection ─────────────────────────────────────────────────────────────
# Reuse the existing SUPABASE_DB_URI from .env.
# psycopg2-binary and sqlalchemy are already in the deps.

def _get_engine():
    uri = os.environ.get("SUPABASE_DB_URI")
    if not uri:
        raise RuntimeError("SUPABASE_DB_URI is not set in environment")
    # SQLAlchemy requires postgresql+psycopg2 scheme
    uri = re.sub(r"^postgres(?:ql)?://", "postgresql+psycopg2://", uri)
    return create_engine(uri, pool_pre_ping=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sanitize_name(raw: str) -> str:
    """Turn a filename into a safe Postgres identifier segment (max 40 chars)."""
    # Strip extension
    name = re.sub(r"\.[^.]+$", "", raw)
    # Replace non-alphanumeric with _
    name = re.sub(r"[^a-z0-9]", "_", name.lower())
    # Collapse runs of underscores
    name = re.sub(r"_+", "_", name).strip("_")
    return name[:40] or "data"


def _build_table_name(thread_id: str, filename: str) -> str:
    tid = re.sub(r"[^a-z0-9]", "", thread_id.lower())[:8]
    fname = _sanitize_name(filename)
    return f"upload_{tid}_{fname}"


def _dtype_label(dtype) -> str:
    """Human-readable dtype label for the agent."""
    s = str(dtype)
    if "int" in s:
        return "INTEGER"
    if "float" in s:
        return "FLOAT"
    if "bool" in s:
        return "BOOLEAN"
    if "datetime" in s:
        return "TIMESTAMP"
    return "TEXT"


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    thread_id: str = Form(...),
):
    """
    Upload a CSV or Excel file and load it into Supabase Postgres.

    Form fields:
        file      — the CSV / .xlsx / .xls file
        thread_id — LangGraph thread ID (used to scope the table name)

    Returns:
        {
            "table_name": "upload_abc12345_sales",
            "columns": [{"name": "revenue", "dtype": "FLOAT"}, ...],
            "row_count": 1234,
            "preview": [{...}, ...]   // first 5 rows as dicts
        }
    """
    filename = file.filename or "data"
    content = await file.read()

    # ── Parse the file ────────────────────────────────────────────
    try:
        if filename.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
        elif filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {filename}. Please upload a .csv, .xlsx, or .xls file.",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {e}")

    if df.empty:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")

    # ── Sanitise column names so they're valid Postgres identifiers ─
    df.columns = [
        re.sub(r"[^a-z0-9_]", "_", str(c).lower().strip()).strip("_") or f"col_{i}"
        for i, c in enumerate(df.columns)
    ]

    # ── Build table name ─────────────────────────────────────────
    table_name = _build_table_name(thread_id, filename)

    # ── Load into Postgres ────────────────────────────────────────
    try:
        engine = _get_engine()
        with engine.begin() as conn:
            # Drop existing table with same name (re-upload replaces)
            conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}"'))

        df.to_sql(
            table_name,
            engine,
            if_exists="replace",
            index=False,
            method="multi",
            chunksize=500,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load data into database: {e}")

    # ── Build response ───────────────────────────────────────────
    columns = [
        {"name": col, "dtype": _dtype_label(df[col].dtype)}
        for col in df.columns
    ]
    preview = df.head(5).fillna("").to_dict(orient="records")

    return {
        "table_name": table_name,
        "columns": columns,
        "row_count": len(df),
        "preview": preview,
    }
