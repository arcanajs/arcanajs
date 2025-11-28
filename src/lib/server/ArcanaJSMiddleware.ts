import { NextFunction, Request, Response } from "express";
import fs from "fs";
import React from "react";
import { renderToString } from "react-dom/server";
import { HeadContext, HeadManager } from "../shared/context/HeadContext";
import { ArcanaJSApp } from "../shared/core/ArcanaJSApp";
import { defaultHtmlTemplate } from "./DefaultTemplate";

const DEFAULT_HTML_TEMPLATE = defaultHtmlTemplate;

// Extend Express Response interface
declare global {
  namespace Express {
    interface Response {
      /**
       * Renders a React page using ArcanaJS SSR.
       *
       * @param page - The name of the page component to render.
       * @param data - Initial data to pass to the page component (default: {}).
       * @param params - Route parameters (default: {}).
       * @returns The Express Response object.
       */
      renderPage(
        page: string,
        data?: any,
        params?: Record<string, string>
      ): Response;
    }
  }
}

interface ArcanaJSOptions {
  views: Record<string, React.FC<any>>;
  indexFile?: string;
  layout?: React.FC<any>;
}

// Helper to prevent XSS in initial data
const safeStringify = (obj: any) => {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
};

export const createArcanaJSMiddleware = (options: ArcanaJSOptions) => {
  const { views, indexFile, layout } = options;
  let cachedIndexHtml: string | null = null;

  const getIndexHtml = (
    callback: (err: NodeJS.ErrnoException | null, data: string) => void
  ) => {
    if (process.env.NODE_ENV === "production" && cachedIndexHtml) {
      return callback(null, cachedIndexHtml);
    }

    if (indexFile && fs.existsSync(indexFile)) {
      fs.readFile(indexFile, "utf8", (err, htmlData) => {
        if (!err && process.env.NODE_ENV === "production") {
          cachedIndexHtml = htmlData;
        }
        callback(err, htmlData);
      });
    } else {
      if (process.env.NODE_ENV === "production") {
        cachedIndexHtml = DEFAULT_HTML_TEMPLATE;
      }
      callback(null, DEFAULT_HTML_TEMPLATE);
    }
  };

  return (req: Request, res: Response, next: NextFunction) => {
    res.renderPage = (
      page: string,
      data: any = {},
      params: Record<string, string> = {}
    ) => {
      const csrfToken = res.locals.csrfToken;

      if (req.get("X-ArcanaJS-Request") || req.query.format === "json") {
        return res.json({ page, data, params, csrfToken });
      }
      try {
        const headTags: React.ReactNode[] = [];
        const headManager: HeadManager = {
          tags: headTags,
          push: (nodes) => headTags.push(nodes),
        };

        const appHtml = renderToString(
          React.createElement(
            HeadContext.Provider,
            { value: headManager },
            React.createElement(ArcanaJSApp, {
              initialPage: page,
              initialData: data,
              initialParams: params,
              initialUrl: req.path,
              csrfToken: csrfToken,
              views: views,
              layout: layout,
            })
          )
        );

        const headHtml = renderToString(
          React.createElement(React.Fragment, null, ...headTags)
        );

        getIndexHtml((err, htmlData) => {
          if (err) {
            console.error("Error reading index.html", err);
            return res.status(500).send("Server Error");
          }

          const scriptContent = safeStringify({
            page,
            data,
            params,
            csrfToken,
          });
          const scriptTag = `<script id="__ARCANAJS_DATA__" type="application/json">${scriptContent}</script>`;

          const hmrScript = process.env.ARCANA_HMR_PORT
            ? `
            <script>
              (function() {
                const socket = new WebSocket("ws://localhost:${process.env.ARCANA_HMR_PORT}");
                socket.onmessage = function(event) {
                  const data = JSON.parse(event.data);
                  if (data.type === "reload") {
                    window.location.reload();
                  }
                };
              })();
            </script>`
            : "";

          const html = htmlData
            .replace("<!--HEAD_CONTENT-->", headHtml)
            .replace("<!--APP_CONTENT-->", appHtml)
            .replace("<!--ARCANAJS_DATA_SCRIPT-->", scriptTag + hmrScript);

          res.send(html);
        });
      } catch (error) {
        console.error("SSR Error:", error);
        return res.status(500).send("Internal Server Error");
      }
      return res;
    };
    next();
  };
};
