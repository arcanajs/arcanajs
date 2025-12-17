import React, { useCallback, useEffect, useRef } from "react";
import useRouter from "../hooks/useRouter";

/**
 * Prefetch strategy for Link component
 */
export type PrefetchStrategy = "hover" | "visible" | "mount" | false;

export interface LinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /**
   * Prefetch strategy:
   * - 'hover': Prefetch on mouse hover (default when prefetch=true)
   * - 'visible': Prefetch when link enters viewport (Intersection Observer)
   * - 'mount': Prefetch immediately on component mount
   * - false: Disable prefetching
   */
  prefetch?: boolean | PrefetchStrategy;
  /** Replace current history entry instead of pushing */
  replace?: boolean;
  /** Scroll to top after navigation (default: true) */
  scroll?: boolean;
  /** State to pass through navigation */
  state?: any;
  /**
   * Shallow navigation - update URL without re-fetching data
   * Useful for updating query params without full navigation
   */
  shallow?: boolean;
  /**
   * Active class name when this link matches current URL
   * If provided, adds this class when link is active
   */
  activeClassName?: string;
  /**
   * Require exact match for active class (default: true)
   * If false, matches if current URL starts with href
   */
  exact?: boolean;
}

/**
 * Link - Professional navigation link component
 *
 * Features:
 * - Client-side navigation with ArcanaJS router
 * - Smart prefetching with multiple strategies (hover, visible, mount)
 * - Intersection Observer for viewport-based prefetching
 * - External link detection and handling
 * - Async/await navigation support
 * - Active link styling support
 * - State passing through navigation
 * - Shallow navigation for query updates
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Link href="/about">About</Link>
 *
 * // Prefetch on hover (default when prefetch=true)
 * <Link href="/products" prefetch>Products</Link>
 *
 * // Prefetch when visible in viewport
 * <Link href="/blog" prefetch="visible">Blog</Link>
 *
 * // With replace instead of push
 * <Link href="/login" replace>Login</Link>
 *
 * // Pass state through navigation
 * <Link href="/checkout" state={{ from: 'cart' }}>Checkout</Link>
 *
 * // Active link styling
 * <Link href="/dashboard" activeClassName="is-active">Dashboard</Link>
 *
 * // Shallow navigation (for query params)
 * <Link href="/products?sort=price" shallow>Sort by Price</Link>
 * ```
 */
const Link: React.FC<LinkProps> = ({
  href,
  children,
  prefetch = false,
  replace = false,
  scroll = true,
  state,
  shallow = false,
  activeClassName,
  exact = true,
  className = "",
  onClick,
  onMouseEnter,
  ...props
}) => {
  const router = useRouter();
  const {
    push,
    replace: routerReplace,
    prefetch: prefetchRoute,
    currentUrl,
    isNavigating,
  } = router;
  const linkRef = useRef<HTMLAnchorElement>(null);
  const prefetchedRef = useRef(false);

  const isExternal = /^https?:\/\//.test(href);

  // Determine if link is active
  const isActive =
    !isExternal &&
    (exact
      ? currentUrl === href || currentUrl === href.split("?")[0]
      : currentUrl.startsWith(href.split("?")[0]));

  // Combine classNames
  const combinedClassName = [className, isActive && activeClassName]
    .filter(Boolean)
    .join(" ");

  // Determine prefetch strategy
  const prefetchStrategy: PrefetchStrategy =
    prefetch === true ? "hover" : prefetch === false ? false : prefetch;

  // Prefetch handler
  const doPrefetch = useCallback(() => {
    if (prefetchedRef.current || isExternal || !prefetchRoute) return;
    prefetchedRef.current = true;
    prefetchRoute(href).catch(() => {
      prefetchedRef.current = false;
    });
  }, [href, isExternal, prefetchRoute]);

  // Intersection Observer for 'visible' strategy
  useEffect(() => {
    if (prefetchStrategy !== "visible" || typeof window === "undefined") return;

    const element = linkRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      const timeoutId = setTimeout(doPrefetch, 1000);
      return () => clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            doPrefetch();
            observer.disconnect();
          }
        });
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [prefetchStrategy, doPrefetch]);

  // Mount prefetch for 'mount' strategy
  useEffect(() => {
    if (prefetchStrategy !== "mount" || typeof window === "undefined") return;

    const timeoutId = setTimeout(doPrefetch, 100);
    return () => clearTimeout(timeoutId);
  }, [prefetchStrategy, doPrefetch]);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);

    // Don't handle if default prevented or modifier keys pressed
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }

    e.preventDefault();

    if (isExternal) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      const options = { scroll, state, shallow };

      if (replace) {
        routerReplace(href, options);
      } else {
        push(href, options);
      }
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(e);

    if (prefetchStrategy === "hover" && !isExternal) {
      doPrefetch();
    }
  };

  return (
    <a
      ref={linkRef}
      href={href}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={combinedClassName || undefined}
      aria-current={isActive ? "page" : undefined}
      {...props}
    >
      {children}
    </a>
  );
};

export default Link;
