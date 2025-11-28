import { createSingletonContext } from "../utils/createSingletonContext";

// PageContext holds the page data (may be null before hydration).
export const PageContext = createSingletonContext<any | null>(
  "PageContext",
  null
);
