import React from "react";
import { createSingletonContext } from "../utils/createSingletonContext";

export interface RouterContextType {
  navigateTo: (url: string) => void;
  // optional async variant for consumers that want a promise
  navigateToAsync?: (url: string) => Promise<void>;
  currentPage: string;
  currentUrl: string;
  params: Record<string, string>;
  csrfToken?: string;
  onNavigate?: (url: string) => void;
  isNavigating: boolean;
}

export const RouterContext = createSingletonContext<RouterContextType | null>(
  "RouterContext",
  null
);

export const RouterProvider: React.FC<{
  value: RouterContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
};
