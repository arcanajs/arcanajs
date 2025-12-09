import { DatabaseAdapter } from "./arcanox/types";
import { DecodedToken } from "./auth/types";

declare const __non_webpack_require__: NodeJS.Require;

declare global {
  var ArcanaJSDatabaseAdapter: DatabaseAdapter;
  namespace Express {
    interface Request {
      user?: DecodedToken;
      token?: string;
    }

    interface Session {
      userId?: string;
      refreshToken?: string;
    }
  }
}
