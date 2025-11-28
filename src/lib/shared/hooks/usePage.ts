import { useContext } from "react";
import { PageContext } from "../context/PageContext";

export const usePage = <T = any>(): T => useContext(PageContext) as T;
