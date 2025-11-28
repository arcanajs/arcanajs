import { useContext } from "react";
import { RouterContext } from "../context/RouterContext";

const useParams = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useParams must be used within an ArcanaJSApp");
  }
  return context.params;
};
export default useParams;
