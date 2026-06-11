"use client"

import React from "react"
import { cx } from "class-variance-authority"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowUp } from "lucide-react"

// ── Color orb ──────────────────────────────────────────────────────

interface OrbProps {
    dimension?: string
    className?: string
    tones?: {
        base?: string
        accent1?: string
        accent2?: string
        accent3?: string
    }
    spinDuration?: number
}

// Shared CSS injected once into the document head
const ORB_CSS = `
@property --angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
.color-orb {
  display: grid;
  grid-template-areas: "stack";
  overflow: hidden;
  border-radius: 50%;
  position: relative;
  transform: scale(1.1);
}
.color-orb::before,
.color-orb::after {
  content: "";
  display: block;
  grid-area: stack;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  transform: translateZ(0);
}
.color-orb::before {
  background:
    conic-gradient(from calc(var(--angle) * 2) at 25% 70%, var(--accent3), transparent 20% 80%, var(--accent3)),
    conic-gradient(from calc(var(--angle) * 2) at 45% 75%, var(--accent2), transparent 30% 60%, var(--accent2)),
    conic-gradient(from calc(var(--angle) * -3) at 80% 20%, var(--accent1), transparent 40% 60%, var(--accent1)),
    conic-gradient(from calc(var(--angle) * 2) at 15% 5%, var(--accent2), transparent 10% 90%, var(--accent2)),
    conic-gradient(from calc(var(--angle) * 1) at 20% 80%, var(--accent1), transparent 10% 90%, var(--accent1)),
    conic-gradient(from calc(var(--angle) * -2) at 85% 10%, var(--accent3), transparent 20% 80%, var(--accent3));
  box-shadow: inset var(--base) 0 0 var(--shadow) calc(var(--shadow) * 0.2);
  filter: blur(var(--blur)) contrast(var(--contrast));
  animation: orb-spin var(--spin-duration) linear infinite;
}
.color-orb::after {
  background-image: radial-gradient(circle at center, var(--base) var(--dot), transparent var(--dot));
  background-size: calc(var(--dot) * 2) calc(var(--dot) * 2);
  backdrop-filter: blur(calc(var(--blur) * 2)) contrast(calc(var(--contrast) * 2));
  mix-blend-mode: overlay;
}
.color-orb[style*="--mask: 0%"]::after { mask-image: none; }
.color-orb:not([style*="--mask: 0%"])::after { mask-image: radial-gradient(black var(--mask), transparent 75%); }
@keyframes orb-spin { to { --angle: 360deg; } }
@media (prefers-reduced-motion: reduce) { .color-orb::before { animation: none; } }
`

function OrbStyles() {
    return <style dangerouslySetInnerHTML={{ __html: ORB_CSS }} />
}

const ColorOrb: React.FC<OrbProps> = ({
    dimension = "192px",
    className,
    tones,
    spinDuration = 20,
}) => {
    const fallbackTones = {
        base: "oklch(95% 0.02 264.695)",
        accent1: "oklch(75% 0.15 350)",
        accent2: "oklch(80% 0.12 200)",
        accent3: "oklch(78% 0.14 280)",
    }

    const palette = { ...fallbackTones, ...tones }
    const dimValue = parseInt(dimension.replace("px", ""), 10)

    const blurStrength = dimValue < 50 ? Math.max(dimValue * 0.008, 1) : Math.max(dimValue * 0.015, 4)
    const contrastStrength = dimValue < 50 ? Math.max(dimValue * 0.004, 1.2) : Math.max(dimValue * 0.008, 1.5)
    const pixelDot = dimValue < 50 ? Math.max(dimValue * 0.004, 0.05) : Math.max(dimValue * 0.008, 0.1)
    const shadowRange = dimValue < 50 ? Math.max(dimValue * 0.004, 0.5) : Math.max(dimValue * 0.008, 2)
    const maskRadius = dimValue < 30 ? "0%" : dimValue < 50 ? "5%" : dimValue < 100 ? "15%" : "25%"
    const adjustedContrast = dimValue < 30 ? 1.1 : dimValue < 50 ? Math.max(contrastStrength * 1.2, 1.3) : contrastStrength

    return (
        <div
            className={cn("color-orb", className)}
            style={{
                width: dimension,
                height: dimension,
                "--base": palette.base,
                "--accent1": palette.accent1,
                "--accent2": palette.accent2,
                "--accent3": palette.accent3,
                "--spin-duration": `${spinDuration}s`,
                "--blur": `${blurStrength}px`,
                "--contrast": adjustedContrast,
                "--dot": `${pixelDot}px`,
                "--shadow": `${shadowRange}px`,
                "--mask": maskRadius,
            } as React.CSSProperties}
        />
    )
}

// ── Context ─────────────────────────────────────────────────────────

const SPEED_FACTOR = 1

interface ContextShape {
    showForm: boolean
    successFlag: boolean
    uploadState: "idle" | "uploading" | "done" | "error"
    uploadFilename: string
    triggerOpen: () => void
    triggerClose: () => void
}

const FormContext = React.createContext({} as ContextShape)
const useFormContext = () => React.useContext(FormContext)

// ── MorphPanel (exported, drop-in replacement for ChatInput) ────────

interface MorphPanelProps {
    onSend: (text: string) => void
    onFileUpload?: (file: File) => Promise<void>
    disabled?: boolean
    placeholder?: string
}

const FORM_WIDTH = 360
const FORM_HEIGHT = 200

export function MorphPanel({ onSend, onFileUpload, disabled, placeholder }: MorphPanelProps) {
    const wrapperRef = React.useRef<HTMLDivElement>(null)
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const [showForm, setShowForm] = React.useState(false)
    const [successFlag, setSuccessFlag] = React.useState(false)
    const [uploadState, setUploadState] = React.useState<"idle" | "uploading" | "done" | "error">("idle")
    const [uploadFilename, setUploadFilename] = React.useState("")

    const triggerClose = React.useCallback(() => {
        setShowForm(false)
        textareaRef.current?.blur()
    }, [])

    const triggerOpen = React.useCallback(() => {
        if (disabled) return
        setShowForm(true)
        setTimeout(() => textareaRef.current?.focus())
    }, [disabled])

    const handleSuccess = React.useCallback((text: string) => {
        onSend(text)
        triggerClose()
        setSuccessFlag(true)
        setTimeout(() => setSuccessFlag(false), 1500)
    }, [onSend, triggerClose])

    const handleFileChange = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !onFileUpload) return
        e.target.value = ""
        setUploadFilename(file.name)
        setUploadState("uploading")
        try {
            await onFileUpload(file)
            setUploadState("done")
            setTimeout(() => setUploadState("idle"), 3000)
        } catch {
            setUploadState("error")
            setTimeout(() => setUploadState("idle"), 4000)
        }
    }, [onFileUpload])

    React.useEffect(() => {
        function clickOutsideHandler(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && showForm) {
                triggerClose()
            }
        }
        document.addEventListener("mousedown", clickOutsideHandler)
        return () => document.removeEventListener("mousedown", clickOutsideHandler)
    }, [showForm, triggerClose])

    const ctx = React.useMemo(
        () => ({ showForm, successFlag, uploadState, uploadFilename, triggerOpen, triggerClose }),
        [showForm, successFlag, uploadState, uploadFilename, triggerOpen, triggerClose]
    )

    return (
        <>
            <OrbStyles />
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled || uploadState === "uploading"}
            />
            <div className="flex flex-col items-center gap-2 w-full max-w-[360px]">
                {/* Upload status pill */}
                <AnimatePresence>
                    {uploadState !== "idle" && (
                        <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                            style={{
                                background: uploadState === "error"
                                    ? "rgba(248,113,113,0.1)"
                                    : uploadState === "done"
                                        ? "rgba(52,211,153,0.1)"
                                        : "rgba(255,255,255,0.06)",
                                border: uploadState === "error"
                                    ? "1px solid rgba(248,113,113,0.3)"
                                    : uploadState === "done"
                                        ? "1px solid rgba(52,211,153,0.3)"
                                        : "1px solid rgba(255,255,255,0.1)",
                                color: uploadState === "error" ? "#f87171" : uploadState === "done" ? "#34d399" : "#999",
                            }}
                        >
                            {uploadState === "uploading" && (
                                <div
                                    className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
                                    style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "transparent" }}
                                />
                            )}
                            {uploadState === "done" && <span>✓</span>}
                            {uploadState === "error" && <span>✕</span>}
                            <span className="truncate max-w-[200px]">
                                {uploadState === "uploading" && `Uploading ${uploadFilename}…`}
                                {uploadState === "done" && `${uploadFilename} ready`}
                                {uploadState === "error" && `Failed to upload ${uploadFilename}`}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div
                    ref={wrapperRef}
                    data-panel
                    className={cx(
                        "bg-background relative bottom-2 z-[3] flex flex-col items-center overflow-hidden border max-sm:bottom-1"
                    )}
                    initial={false}
                    animate={{
                        width: showForm ? "100%" : "auto",
                        height: showForm ? "auto" : 44,
                        borderRadius: showForm ? 14 : 20,
                    }}
                    style={{ maxWidth: FORM_WIDTH }}
                    transition={{
                        type: "spring",
                        stiffness: 550 / SPEED_FACTOR,
                        damping: 45,
                        mass: 0.7,
                        delay: showForm ? 0 : 0.08,
                    }}
                >
                    <FormContext.Provider value={ctx}>
                        <DockBar disabled={disabled} onAttachClick={() => fileInputRef.current?.click()} />
                        <InputForm
                            ref={textareaRef}
                            onSuccess={handleSuccess}
                            disabled={disabled}
                            placeholder={placeholder}
                        />
                    </FormContext.Provider>
                </motion.div>
            </div>
        </>
    )
}


// ── DockBar ─────────────────────────────────────────────────────────

function DockBar({ disabled, onAttachClick }: { disabled?: boolean; onAttachClick?: () => void }) {
    const { showForm, triggerOpen, uploadState } = useFormContext()
    return (
        <footer
            className="mt-auto flex h-[44px] items-center justify-center whitespace-nowrap select-none w-full"
            style={{ position: showForm ? "absolute" : "relative", bottom: 0, opacity: showForm ? 0 : 1, pointerEvents: showForm ? "none" : "all" }}
        >
            <div className="flex items-center justify-center gap-2 px-3 max-sm:h-10 max-sm:px-2">
                <div className="flex w-fit items-center gap-2">
                    <AnimatePresence mode="wait">
                        {showForm ? (
                            <motion.div
                                key="blank"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0 }}
                                exit={{ opacity: 0 }}
                                className="h-5 w-5"
                            />
                        ) : (
                            <motion.div
                                key="orb"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ColorOrb dimension="24px" tones={{ base: "oklch(22.64% 0 0)" }} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <Button
                    type="button"
                    className="flex h-fit flex-1 justify-end rounded-full px-2 !py-0.5"
                    variant="ghost"
                    onClick={triggerOpen}
                    disabled={disabled}
                >
                    <span className="truncate">
                        {disabled ? "Swift is thinking…" : "Ask Swift"}
                    </span>
                </Button>

                {/* Paperclip attach button */}
                <AnimatePresence>
                    {!showForm && (
                        <motion.button
                            type="button"
                            id="attach-file-btn"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            onClick={onAttachClick}
                            disabled={disabled || uploadState === "uploading"}
                            title="Upload CSV or Excel file"
                            className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200"
                            style={{
                                color: uploadState === "uploading" ? "#555" : "#666",
                                background: "transparent",
                                cursor: disabled || uploadState === "uploading" ? "not-allowed" : "pointer",
                            }}
                            onMouseEnter={(e) => { if (!disabled && uploadState !== "uploading") (e.currentTarget as HTMLElement).style.color = "#ccc" }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = uploadState === "uploading" ? "#555" : "#666" }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>
        </footer>
    )
}

// ── InputForm ────────────────────────────────────────────────────────

interface InputFormProps {
    ref: React.Ref<HTMLTextAreaElement>
    onSuccess: (text: string) => void
    disabled?: boolean
    placeholder?: string
}

function InputForm({ ref, onSuccess, disabled, placeholder }: InputFormProps) {
    const { triggerClose, showForm } = useFormContext()
    const btnRef = React.useRef<HTMLButtonElement>(null)
    const [value, setValue] = React.useState("")

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const text = value.trim()
        if (!text || disabled) return
        onSuccess(text)
        setValue("")
    }

    function handleKeys(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Escape") triggerClose()
        if (e.key === "Enter" && !e.shiftKey) {
            // Only submit on Enter if we are on a desktop device
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                e.preventDefault()
                btnRef.current?.click()
            }
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="w-full"
            style={{
                position: showForm ? "relative" : "absolute",
                bottom: 0,
                width: "100%",
                maxWidth: FORM_WIDTH,
                pointerEvents: showForm ? "all" : "none"
            }}
        >
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 550 / SPEED_FACTOR, damping: 45, mass: 0.7 }}
                        className="flex flex-col p-1 relative w-full"
                    >
                        <textarea
                            ref={ref}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 300)}px`;
                            }}
                            placeholder={placeholder ?? "Ask me anything..."}
                            name="message"
                            className="w-full resize-none scroll-py-2 rounded-md px-4 pt-4 pb-12 outline-0 bg-transparent text-foreground"
                            style={{ minHeight: "120px" }}
                            disabled={disabled}
                            onKeyDown={handleKeys}
                            spellCheck={false}
                        />
                        <button
                            type="submit"
                            ref={btnRef}
                            disabled={disabled || !value.trim()}
                            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            style={{
                                background: "#ffffff",
                                color: "#000000",
                                border: "1px solid var(--border)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                            }}
                        >
                            <ArrowUp size={18} strokeWidth={2.5} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none"
                    >
                        <ColorOrb dimension="24px" tones={{ base: "oklch(22.64% 0 0)" }} />
                        <span className="text-foreground text-sm font-medium opacity-80 select-none">
                            Ask Swift
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </form>
    )
}

// ── KeyHint ──────────────────────────────────────────────────────────

function KeyHint({ children, className }: { children: string; className?: string }) {
    return (
        <kbd
            className={cx(
                "text-foreground flex h-6 w-fit items-center justify-center rounded-sm border px-[6px] font-sans",
                className
            )}
        >
            {children}
        </kbd>
    )
}

export default MorphPanel
