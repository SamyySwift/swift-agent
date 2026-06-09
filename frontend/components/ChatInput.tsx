"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  function autoResize() {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
  }

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (ref.current) {
      ref.current.style.height = "auto";
    }
  }, [disabled, onSend, value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className="flex items-end gap-3 rounded-2xl px-4 py-2 transition-all"
      style={{
        background: "#111c2e",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
      onFocusCapture={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(99,102,241,0.5)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)";
      }}
      onBlurCapture={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.1)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        disabled={disabled}
        value={value}
        placeholder={placeholder ?? "Message Swift..."}
        onChange={(e) => {
          setValue(e.target.value);
          autoResize();
        }}
        onKeyDown={handleKeyDown}
        className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed py-2"
        style={{
          color: "#e2e8f0",
          maxHeight: "160px",
          overflowY: "auto",
        }}
      />

      {/* Send / loading button */}
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="shrink-0 w-9 h-9 mb-0.5 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background:
            disabled || !value.trim()
              ? "#162035"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
          boxShadow:
            !disabled && value.trim()
              ? "0 2px 14px rgba(99,102,241,0.4)"
              : "none",
        }}
      >
        {disabled ? (
          <span className="flex gap-0.5 items-center">
            {[0, 100, 200].map((d) => (
              <span
                key={d}
                className="block w-1 h-1 rounded-full bg-white/40"
                style={{ animation: `pulse-dot 1.2s ${d}ms ease-in-out infinite` }}
              />
            ))}
          </span>
        ) : (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M1.5 7.5L13.5 1.5L8.5 13.5L6.5 8.5L1.5 7.5Z"
              fill="white"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
