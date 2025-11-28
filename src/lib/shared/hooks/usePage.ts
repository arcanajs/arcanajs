import { useContext } from "react";
import { PageContext } from "../context/PageContext";

const usePage = <T = any>(): T => useContext(PageContext) as T;
export default usePage;
