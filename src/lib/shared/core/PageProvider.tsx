import React from "react";
import { PageContext } from "../context/PageContext";

/**
 * PageProvider - Internal framework component for ArcanaJS
 *
 * This is an INTERNAL component used by the ArcanaJS framework to provide
 * page data context. Developers should NOT use this directly.
 *
 * Use the `Page` component instead for creating pages.
 *
 * @internal
 */
export const PageProvider = <T,>({
  data,
  children,
}: {
  data?: T;
  children: React.ReactNode;
}) => {
  return (
    <PageContext.Provider value={data as unknown}>
      {children}
    </PageContext.Provider>
  );
};

export default PageProvider;
