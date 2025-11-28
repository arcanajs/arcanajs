import React, { useEffect } from "react";
import { useHead } from "../hooks/useHead";

const Head: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const headManager = useHead();

  // Server-side: Push tags to context
  if (typeof window === "undefined" && headManager) {
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
      if (React.isValidElement(child)) {
        const reactElement = child as React.ReactElement<any>;
        if (reactElement.type === "title") {
          document.title = reactElement.props.children as string;
        } else if (reactElement.type === "meta") {
          const props = reactElement.props;
          // Try to find existing meta tag
          let selector = "meta";
          if (props.name) selector += `[name="${props.name}"]`;
          if (props.property) selector += `[property="${props.property}"]`;

          // Only select if we have a specific identifier
          if (props.name || props.property) {
            let element =
              document.querySelector(
                selector + '[data-arcanajs-head="true"]'
              ) || document.querySelector(selector);

            if (element) {
              // Update existing
              element.setAttribute("content", props.content);
              element.setAttribute("data-arcanajs-head", "true");
              managedElements.push(element as HTMLElement);
            } else {
              // Create new
              const newMeta = document.createElement("meta");
              Object.keys(props).forEach((key) => {
                newMeta.setAttribute(key, props[key]);
              });
              newMeta.setAttribute("data-arcanajs-head", "true");
              document.head.appendChild(newMeta);
              managedElements.push(newMeta);
            }
          }
        } else if (reactElement.type === "link") {
          const props = reactElement.props;
          let selector = "link";
          if (props.rel) selector += `[rel="${props.rel}"]`;
          if (props.href) selector += `[href="${props.href}"]`;

          let element =
            document.querySelector(selector + '[data-arcanajs-head="true"]') ||
            document.querySelector(selector);

          if (element) {
            element.setAttribute("data-arcanajs-head", "true");
            managedElements.push(element as HTMLElement);
          } else {
            const newLink = document.createElement("link");
            Object.keys(props).forEach((key) => {
              newLink.setAttribute(key, props[key]);
            });
            newLink.setAttribute("data-arcanajs-head", "true");
            document.head.appendChild(newLink);
            managedElements.push(newLink);
          }
        }
      }
    });

    return () => {
      // Cleanup managed elements
      managedElements.forEach((el) => {
        // We remove the element to ensure clean state for the next page
        // Note: This might cause a momentary flicker if the next page re-adds it immediately
        el.remove();
      });
    };
  }, [children]);

  return null;
};
export default Head;
