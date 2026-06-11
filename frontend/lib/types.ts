// ──────────────────────────────────────────────────
// Core message / event types mirroring the LangGraph
// SSE stream events used by the Swift agent.
// ──────────────────────────────────────────────────

export type Role = "human" | "ai" | "tool" | "system";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface RawMessage {
  type?: string;
  role?: string;
  content?: string | ContentBlock[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  status?: string;
  id?: string;
}

export interface ContentBlock {
  type: string;
  text?: string;
}

// ──────────────────────────────────────────────────
// What the UI renders — one item per "event"
// ──────────────────────────────────────────────────

export type ChatItemKind =
  | "human"
  | "ai"
  | "tool_call"
  | "tool_result"
  | "interrupt"
  | "error"
  | "file_upload";

export interface HumanItem {
  kind: "human";
  id: string;
  text: string;
}

export interface AIItem {
  kind: "ai";
  id: string;
  text: string;
  streaming?: boolean;
}

export interface ToolCallItem {
  kind: "tool_call";
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultItem {
  kind: "tool_result";
  id: string;
  name: string;
  content: string;
  isError: boolean;
}

export interface InterruptItem {
  kind: "interrupt";
  id: string;
  payload: InterruptPayload;
  resolved?: boolean;
}

export interface ErrorItem {
  kind: "error";
  id: string;
  message: string;
}

export interface FileUploadColumn {
  name: string;
  dtype: string;
}

export interface FileUploadItem {
  kind: "file_upload";
  id: string;
  filename: string;
  tableName: string;
  rowCount: number;
  columns: FileUploadColumn[];
  preview: Record<string, unknown>[];
}

export type ChatItem =
  | HumanItem
  | AIItem
  | ToolCallItem
  | ToolResultItem
  | InterruptItem
  | ErrorItem
  | FileUploadItem;

// ──────────────────────────────────────────────────
// Interrupt shape from the LangGraph values event
// ──────────────────────────────────────────────────

export interface InterruptPayload {
  message: string;
  tool_call: ToolCall;
  args: Record<string, unknown>;
}

// ──────────────────────────────────────────────────
// Interrupt decision sent back to the graph
// ──────────────────────────────────────────────────

export type InterruptAction = "approve" | "update" | "feedback" | "reject";

export interface InterruptDecision {
  action: InterruptAction;
  args?: Record<string, unknown>;
  message?: string;
}

// ──────────────────────────────────────────────────
// Thread metadata stored in localStorage
// ──────────────────────────────────────────────────

export interface ThreadMeta {
  threadId: string;
  title: string;
  createdAt: number;
}
