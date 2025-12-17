import {
  useCallback,
  useTransition as useReactTransition,
  useState,
} from "react";
import useRouter from "./useRouter";

/**
 * Return type for useTransition hook
 */
export interface UseTransitionReturn {
  /** Whether a transition is pending */
  isPending: boolean;
  /** Start a non-blocking transition */
  startTransition: (callback: () => void) => void;
  /** Navigate with transition (non-blocking) */
  navigateWithTransition: (url: string) => void;
  /** Loading state during route change */
  isNavigating: boolean;
}

/**
 * useTransition - Route transition hook
 *
 * Wraps React 18's useTransition with router awareness.
 * Use this for non-blocking UI updates during navigation
 * and to show pending states while transitions complete.
 *
 * @example
 * ```tsx
 * // Non-blocking navigation
 * const { isPending, navigateWithTransition } = useTransition();
 *
 * const handleClick = () => {
 *   navigateWithTransition('/heavy-page');
 * };
 *
 * return (
 *   <button onClick={handleClick} style={{ opacity: isPending ? 0.7 : 1 }}>
 *     {isPending ? 'Loading...' : 'Go to Heavy Page'}
 *   </button>
 * );
 *
 * // Manual transition control
 * const { startTransition, isPending } = useTransition();
 *
 * const handleUpdate = () => {
 *   startTransition(() => {
 *     setLargeDataSet(newData);
 *   });
 * };
 * ```
 */
function useTransition(): UseTransitionReturn {
  const { navigateTo, isNavigating } = useRouter();
  const [isPending, startReactTransition] = useReactTransition();
  const [transitionPending, setTransitionPending] = useState(false);

  const startTransition = useCallback(
    (callback: () => void) => {
      startReactTransition(() => {
        callback();
      });
    },
    [startReactTransition]
  );

  const navigateWithTransition = useCallback(
    (url: string) => {
      setTransitionPending(true);
      startReactTransition(() => {
        navigateTo(url);
        // Reset after navigation starts
        setTimeout(() => setTransitionPending(false), 0);
      });
    },
    [navigateTo, startReactTransition]
  );

  return {
    isPending: isPending || transitionPending,
    startTransition,
    navigateWithTransition,
    isNavigating,
  };
}

export default useTransition;
