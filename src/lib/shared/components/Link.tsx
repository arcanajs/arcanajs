import React, { useCallback, useEffect, useRef } from "react";
import useRouter from "../hooks/useRouter";

/**
 * Prefetch strategy for Link component
 */
export type PrefetchStrategy = "hover" | "visible" | "mount" | false;

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
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
}

/**
 * Link - Enhanced navigation link component
 *
 * Features:
 * - Client-side navigation with ArcanaJS router
 * - Smart prefetching with multiple strategies (hover, visible, mount)
 * - Intersection Observer for viewport-based prefetching
 * - External link detection and handling
 * - Async/await navigation support
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
 * // Prefetch immediately on mount
 * <Link href="/contact" prefetch="mount">Contact</Link>
 * ```
 */
const Link: React.FC<LinkProps> = ({
  href,
  children,
  prefetch = false,
  replace = false,
  scroll = true,
  onClick,
  onMouseEnter,
  ...props
}) => {
  const { navigateTo, navigateToAsync, prefetchRoute } = useRouter();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const prefetchedRef = useRef(false);

  const isExternal = /^https?:\/\//.test(href);

  // Determine prefetch strategy
  const prefetchStrategy: PrefetchStrategy =
    prefetch === true ? "hover" : prefetch === false ? false : prefetch;

  // Prefetch handler
  const doPrefetch = useCallback(() => {
    if (prefetchedRef.current || isExternal || !prefetchRoute) return;
    prefetchedRef.current = true;
    prefetchRoute(href).catch(() => {
      // Silently ignore prefetch errors
      prefetchedRef.current = false;
    });
  }, [href, isExternal, prefetchRoute]);

  // Intersection Observer for 'visible' strategy
  useEffect(() => {
    if (prefetchStrategy !== "visible" || typeof window === "undefined") return;

    const element = linkRef.current;
    if (!element) return;

    // Check for IntersectionObserver support
    if (!("IntersectionObserver" in window)) {
      // Fallback: prefetch after a short delay
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
        rootMargin: "100px", // Start prefetching 100px before visible
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

    // Small delay to not block initial render
    const timeoutId = setTimeout(doPrefetch, 100);
    return () => clearTimeout(timeoutId);
  }, [prefetchStrategy, doPrefetch]);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call original onClick if provided
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
      // Open external links in a new tab
      window.open(href, "_blank", "noopener,noreferrer");
    } else if (navigateToAsync) {
      await navigateToAsync(href);
    } else {
      navigateTo(href);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call original onMouseEnter if provided
    onMouseEnter?.(e);

    // Prefetch on hover
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
      {...props}
    >
      {children}
    </a>
  );
};

export default Link;
