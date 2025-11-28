import { useContext } from "react";
import { RouterContext } from "../context/RouterContext";

const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within an ArcanaJSApp");
  }
  return context;
};
export default useRouter;
