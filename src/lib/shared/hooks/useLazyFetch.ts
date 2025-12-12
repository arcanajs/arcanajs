import useFetch, { UseFetchOptions, UseFetchReturn } from "./useFetch";

/**
 * useLazyFetch - Deferred data fetching hook
 *
 * Identical to useFetch but with immediate: false by default.
 * Perfect for user-triggered actions like form submissions,
 * button clicks, or conditional data loading.
 *
 * Features:
 * - All features from useFetch
 * - Manual execution via execute()
 * - No automatic fetch on mount
 *
 * @example
 * ```tsx
 * // Manual fetch on button click
 * const { data, pending, execute } = useLazyFetch<SearchResults>('/api/search?q=' + query);
 *
 * const handleSearch = async () => {
 *   await execute();
 * };
 *
 * // Form submission
 * const { data, pending, execute } = useLazyFetch('/api/users', {
 *   method: 'POST',
 *   body: formData,
 * });
 *
 * const handleSubmit = async () => {
 *   try {
 *     await execute();
 *     alert('User created!');
 *   } catch (error) {
 *     alert('Failed to create user');
 *   }
 * };
 * ```
 */
function useLazyFetch<T = any>(
  url: string | (() => string | null),
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  return useFetch<T>(url, {
    ...options,
    immediate: false,
  });
}

export default useLazyFetch;
