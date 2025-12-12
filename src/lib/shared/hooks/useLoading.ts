import useRouter from "./useRouter";

/**
 * Return type for useLoading hook
 */
export interface UseLoadingReturn {
  /** Whether navigation is in progress */
  isLoading: boolean;
  /** Alias for isLoading */
  isNavigating: boolean;
}

/**
 * useLoading - Navigation loading state hook
 *
 * Provides access to the global navigation loading state.
 * Perfect for showing progress bars, spinners, or skeleton screens
 * during page transitions.
 *
 * @example
 * ```tsx
 * // Show loading bar
 * const { isLoading } = useLoading();
 *
 * return (
 *   <>
 *     {isLoading && <LoadingBar />}
 *     <main>{children}</main>
 *   </>
 * );
 *
 * // Full page loader
 * const { isNavigating } = useLoading();
 *
 * if (isNavigating) {
 *   return <FullPageSpinner />;
 * }
 * ```
 */
function useLoading(): UseLoadingReturn {
  const { isNavigating } = useRouter();

  return {
    isLoading: isNavigating,
    isNavigating,
  };
}

export default useLoading;
