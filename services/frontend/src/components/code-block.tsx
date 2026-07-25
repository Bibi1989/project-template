"use client";

import { useState } from "react";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CodeBlock({
  children,
  title,
}: {
  children: string;
  title?: string;
}) {
  const code = children.trim();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <figure className="my-5 overflow-hidden rounded-sm border border-line bg-code">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <figcaption className="min-w-0 truncate font-mono text-xs text-muted">
          {title ?? "command"}
        </figcaption>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] text-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={copied ? "Copied" : "Copy command"}
        >
          {copied ? (
            <>
              <CheckIcon />
              <span>Copied</span>
            </>
          ) : (
            <>
              <CopyIcon />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-ink/95">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
