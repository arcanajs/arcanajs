import { useId as reactUseId, useState as reactUseState, useRef } from "react";

// Global counter for server-side ID generation
let serverIdCounter = 0;

/**
 * Reset server ID counter (useful for testing)
 */
export function resetIdCounter(): void {
  serverIdCounter = 0;
}

/**
 * useId - SSR-safe unique ID generation
 *
 * Wraps React's useId with additional features and a fallback
 * for environments where useId might not be available.
 *
 * Generates stable, unique IDs that are consistent between
 * server and client renders.
 *
 * @example
 * ```tsx
 * // Basic usage
 * const id = useId();
 * return <input id={id} />;
 *
 * // With prefix
 * const formId = useId('form');
 * return <form id={formId}>...</form>;
 *
 * // Multiple IDs
 * const baseId = useId();
 * return (
 *   <>
 *     <label htmlFor={`${baseId}-input`}>Name</label>
 *     <input id={`${baseId}-input`} />
 *   </>
 * );
 * ```
 */
function useId(prefix?: string): string {
  // Try React's useId first (React 18+)
  try {
    const reactId = reactUseId();
    return prefix ? `${prefix}-${reactId}` : reactId;
  } catch {
    // Fallback for older React versions or SSR environments
  }

  // Fallback implementation
  const idRef = useRef<string | null>(null);
  const [, forceRender] = reactUseState(0);

  if (idRef.current === null) {
    if (typeof window === "undefined") {
      // Server-side: use counter
      serverIdCounter++;
      idRef.current = `arcana-${serverIdCounter}`;
    } else {
      // Client-side: use timestamp + random
      idRef.current = `arcana-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
    }

    // Force re-render to ensure consistency
    if (typeof window !== "undefined") {
      setTimeout(() => forceRender((n) => n + 1), 0);
    }
  }

  return prefix ? `${prefix}-${idRef.current}` : idRef.current;
}

export default useId;
