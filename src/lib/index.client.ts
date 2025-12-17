// ============================================================================
// Component Exports
// ============================================================================

export { default as Body } from "./shared/components/Body";
export { default as Head } from "./shared/components/Head";
export { default as Link } from "./shared/components/Link";
export { default as NavLink } from "./shared/components/NavLink";
export { default as Page } from "./shared/components/Page";

// Component types
export type { LinkProps, PrefetchStrategy } from "./shared/components/Link";

// ============================================================================
// Client Exports
// ============================================================================

export { default as hydrateArcanaJS } from "./client/index";

// ============================================================================
// Universal Redirect (SSR + SPA)
// ============================================================================

export {
  isRedirectError,
  navigateTo,
  permanentRedirect,
  redirect,
  RedirectError,
  temporaryRedirect,
} from "./shared/utils/redirect";

// ============================================================================
// Hook Exports
// ============================================================================

// Core routing hooks
export { useHead } from "./shared/hooks/useHead";
export { default as useLocation } from "./shared/hooks/useLocation";
export { default as usePage } from "./shared/hooks/usePage";
export { default as useParams } from "./shared/hooks/useParams";
export { default as useQuery } from "./shared/hooks/useQuery";
export { default as useRouter } from "./shared/hooks/useRouter";

// NEW: Professional routing hooks
export {
  useNavigationEventOnce,
  default as useNavigationEvents,
} from "./shared/hooks/useNavigationEvents";
export { default as usePathname } from "./shared/hooks/usePathname";
export {
  default as useRouteMatch,
  useRouteMatchCheck,
} from "./shared/hooks/useRouteMatch";
export { default as useSearchParams } from "./shared/hooks/useSearchParams";

// Data fetching hooks
export { default as useAsyncData } from "./shared/hooks/useAsyncData";
export { default as useFetch } from "./shared/hooks/useFetch";
export { default as useLazyFetch } from "./shared/hooks/useLazyFetch";

// Navigation state hooks
export { default as useLoading } from "./shared/hooks/useLoading";
export { default as useTransition } from "./shared/hooks/useTransition";

// SSR-compatible hooks
export { default as useCookie } from "./shared/hooks/useCookie";
export { default as useError } from "./shared/hooks/useError";
export { default as useId } from "./shared/hooks/useId";
export { default as useRequest } from "./shared/hooks/useRequest";
export { default as useRequestHeaders } from "./shared/hooks/useRequestHeaders";
export { default as useRuntimeConfig } from "./shared/hooks/useRuntimeConfig";
export { default as useState } from "./shared/hooks/useState";

// ============================================================================
// State Management - Pro Store System
// ============================================================================

// Core store
export {
  createStore,
  defineStore,
  getAllStoreStates,
  getStores,
  getStoreState,
  hydrateStores,
  setSSRStoreState,
  subscribeToDevTools,
} from "./shared/store/createStore";

// State management hooks
export { useAction, default as useActions } from "./shared/hooks/useActions";
export {
  default as useComputed,
  useComputedAsync,
  useComputedWithCompare,
} from "./shared/hooks/useComputed";
export {
  default as useDispatch,
  useTypedDispatch,
} from "./shared/hooks/useDispatch";
export {
  createSelector,
  useMultiSelector,
  default as useSelector,
  useSelectorWithDeps,
  useShallowEqualSelector,
} from "./shared/hooks/useSelector";
export {
  default as useStore,
  useStoreReset,
  useStoreState,
} from "./shared/hooks/useStore";

// ============================================================================
// Context Exports
// ============================================================================

export {
  createRequestContext,
  getClientRequestContext,
  RequestContext,
  RequestContextProvider,
} from "./shared/context/RequestContext";
export {
  parseQueryString,
  RouterContext,
  RouterProvider,
  serializeQueryString,
} from "./shared/context/RouterContext";
export {
  clearGlobalError,
  createError,
  ErrorContext,
  getGlobalError,
  setGlobalError,
  showError,
} from "./shared/hooks/useError";
export {
  getPublicRuntimeConfig,
  getRuntimeConfig,
  RuntimeConfigContext,
  setRuntimeConfig,
} from "./shared/hooks/useRuntimeConfig";
export {
  clearSharedState,
  getSharedState,
  setSharedState,
  SharedStateContext,
  SharedStateProvider,
} from "./shared/hooks/useState";

// ============================================================================
// Types
// ============================================================================

// Router context types
export type {
  NavigateOptions,
  RouterContextType,
} from "./shared/context/RouterContext";

// Routing hook types
export type { NavigationEventHandlers } from "./shared/hooks/useNavigationEvents";
export type {
  RouteMatchResult,
  UseRouteMatchOptions,
} from "./shared/hooks/useRouteMatch";
export type { UseRouterReturn } from "./shared/hooks/useRouter";
export type {
  SetSearchParamsFunction,
  SetSearchParamsOptions,
  UseSearchParamsReturn,
} from "./shared/hooks/useSearchParams";

// Data fetching types
export type {
  UseAsyncDataOptions,
  UseAsyncDataReturn,
} from "./shared/hooks/useAsyncData";
export type {
  FetchStatus,
  UseFetchOptions,
  UseFetchReturn,
} from "./shared/hooks/useFetch";
export type { UseLoadingReturn } from "./shared/hooks/useLoading";
export type { UseTransitionReturn } from "./shared/hooks/useTransition";

// SSR-compatible types
export type { RequestContextType } from "./shared/context/RequestContext";
export type {
  UseCookieOptions,
  UseCookieReturn,
} from "./shared/hooks/useCookie";
export type { ArcanaError } from "./shared/hooks/useError";
export type { UseRequestReturn } from "./shared/hooks/useRequest";
export type { RuntimeConfig } from "./shared/hooks/useRuntimeConfig";
