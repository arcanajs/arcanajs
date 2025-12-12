import React, { useEffect, useRef } from "react";
import { useHead } from "../hooks/useHead";

/**
 * HeadProps - Props for the Head component
 */
export interface HeadProps {
  /** Child elements (title, meta, link, script, style) */
  children: React.ReactNode;
}

/**
 * Common meta tag definitions for convenience
 */
export interface MetaDefinition {
  /** Standard name attribute */
  name?: string;
  /** Open Graph / Twitter property */
  property?: string;
  /** HTTP equiv */
  httpEquiv?: string;
  /** Content value */
  content: string;
  /** Charset (for charset meta) */
  charset?: string;
}

/**
 * Head - Document head management component for ArcanaJS
 *
 * Use this component to manage document head elements like title,
 * meta tags, links, and scripts. Works seamlessly with SSR.
 *
 * ## Supported Elements
 *
 * - `<title>` - Page title
 * - `<meta>` - Meta tags (SEO, Open Graph, Twitter)
 * - `<link>` - Stylesheets, preload, canonical
 * - `<script>` - External scripts, JSON-LD
 * - `<style>` - Inline styles (use sparingly)
 *
 * @example
 * ```tsx
 * // Basic SEO tags
 * import { Head } from 'arcanajs/client';
 *
 * <Head>
 *   <title>My Awesome Page</title>
 *   <meta name="description" content="Page description for SEO" />
 *   <meta name="keywords" content="react, arcanajs, framework" />
 * </Head>
 * ```
 *
 * @example
 * ```tsx
 * // Social media / Open Graph
 * import { Head } from 'arcanajs/client';
 *
 * <Head>
 *   <title>Share This!</title>
 *   <meta property="og:title" content="Share This!" />
 *   <meta property="og:description" content="Check out this page" />
 *   <meta property="og:image" content="https://example.com/og.jpg" />
 *   <meta property="og:url" content="https://example.com/page" />
 *   <meta name="twitter:card" content="summary_large_image" />
 * </Head>
 * ```
 *
 * @example
 * ```tsx
 * // Preloading resources
 * import { Head } from 'arcanajs/client';
 *
 * <Head>
 *   <link rel="preload" href="/fonts/Inter.woff2" as="font" crossOrigin="" />
 *   <link rel="preconnect" href="https://api.example.com" />
 *   <link rel="canonical" href="https://example.com/page" />
 * </Head>
 * ```
 *
 * @example
 * ```tsx
 * // JSON-LD structured data
 * import { Head } from 'arcanajs/client';
 *
 * const structuredData = {
 *   "@context": "https://schema.org",
 *   "@type": "Article",
 *   "headline": "My Article",
 * };
 *
 * <Head>
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
 *   />
 * </Head>
 * ```
 */
const Head: React.FC<HeadProps> = ({ children }) => {
  const headManager = useHead();
  const processedRef = useRef(false);

  // Server-side: Push tags to context
  if (typeof window === "undefined" && headManager && !processedRef.current) {
    processedRef.current = true;
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        headManager.push(
          React.cloneElement(child as React.ReactElement<any>, {
            "data-arcanajs-head": "true",
          })
        );
      }
    });
  }

  // Client-side: Update DOM
  useEffect(() => {
    const managedElements: HTMLElement[] = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;

      const reactElement = child as React.ReactElement<any>;
      const tagType = reactElement.type;

      // Handle title
      if (tagType === "title") {
        const newTitle = reactElement.props.children;
        if (typeof newTitle === "string") {
          document.title = newTitle;
        }
        return;
      }

      // Handle meta tags
      if (tagType === "meta") {
        const props = reactElement.props;
        const element = createOrUpdateElement("meta", props, {
          identifiers: ["name", "property", "http-equiv", "charset"],
        });
        if (element) managedElements.push(element);
        return;
      }

      // Handle link tags
      if (tagType === "link") {
        const props = reactElement.props;
        const element = createOrUpdateElement("link", props, {
          identifiers: ["rel", "href"],
        });
        if (element) managedElements.push(element);
        return;
      }

      // Handle script tags
      if (tagType === "script") {
        const props = reactElement.props;
        const script = document.createElement("script");

        Object.keys(props).forEach((key) => {
          if (key === "dangerouslySetInnerHTML") {
            script.innerHTML = props[key].__html;
          } else if (key === "children") {
            script.innerHTML = typeof props[key] === "string" ? props[key] : "";
          } else if (key !== "key" && key !== "ref") {
            script.setAttribute(
              key === "className" ? "class" : key,
              props[key]
            );
          }
        });

        script.setAttribute("data-arcanajs-head", "true");
        document.head.appendChild(script);
        managedElements.push(script);
        return;
      }

      // Handle style tags
      if (tagType === "style") {
        const props = reactElement.props;
        const style = document.createElement("style");

        if (props.dangerouslySetInnerHTML) {
          style.innerHTML = props.dangerouslySetInnerHTML.__html;
        } else if (props.children) {
          style.innerHTML =
            typeof props.children === "string" ? props.children : "";
        }

        style.setAttribute("data-arcanajs-head", "true");
        document.head.appendChild(style);
        managedElements.push(style);
        return;
      }
    });

    return () => {
      // Cleanup managed elements on unmount
      managedElements.forEach((el) => {
        if (el.parentNode) {
          el.remove();
        }
      });
    };
  }, [children]);

  return null;
};

/**
 * Helper to create or update head elements
 */
function createOrUpdateElement(
  tagName: string,
  props: Record<string, any>,
  options: { identifiers: string[] }
): HTMLElement | null {
  let selector = tagName;
  let hasIdentifier = false;

  // Build selector from identifiers
  for (const id of options.identifiers) {
    const propName = id === "http-equiv" ? "httpEquiv" : id;
    if (props[propName]) {
      selector += `[${id}="${props[propName]}"]`;
      hasIdentifier = true;
    }
  }

  if (!hasIdentifier && tagName !== "link") {
    return null; // Skip elements without identifiers (except links which can be unique by href)
  }

  // Try to find existing element
  let element =
    document.querySelector(selector + '[data-arcanajs-head="true"]') ||
    document.querySelector(selector);

  if (element) {
    // Update existing element
    Object.keys(props).forEach((key) => {
      if (key !== "key" && key !== "ref" && key !== "children") {
        const attrName = key === "className" ? "class" : key;
        element!.setAttribute(attrName, props[key]);
      }
    });
    element.setAttribute("data-arcanajs-head", "true");
  } else {
    // Create new element
    element = document.createElement(tagName);
    Object.keys(props).forEach((key) => {
      if (key !== "key" && key !== "ref" && key !== "children") {
        const attrName = key === "className" ? "class" : key;
        element!.setAttribute(attrName, props[key]);
      }
    });
    element.setAttribute("data-arcanajs-head", "true");
    document.head.appendChild(element);
  }

  return element as HTMLElement;
}

export default Head;
