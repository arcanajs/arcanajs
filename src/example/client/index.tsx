import { hydrateArcanaJS } from "../../lib/client";
import "./index.css";

hydrateArcanaJS((require as any).context("../views", true, /\.tsx$/));
