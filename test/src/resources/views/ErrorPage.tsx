import { Body, Head, Link, Page } from "arcanajs/client";

interface ErrorPageProps {
  message?: string;
  statusCode?: number;
  stack?: string;
}

export default function ErrorPage({
  message = "Something went wrong",
  statusCode = 500,
  stack,
}: ErrorPageProps) {
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <Page>
      <Head>
        <title>{statusCode} - Server Error</title>
        <meta name="description" content="An error occurred on the server" />
      </Head>
      <Body>
        <div className="relative min-h-screen overflow-hidden bg-black text-white flex flex-col justify-center items-center px-4 font-sans">
          {/* Animated Background */}
          <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 grid-pattern opacity-30"></div>
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-red-600 rounded-full opacity-20 blur-3xl animate-glow"></div>
            <div
              className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-orange-600 rounded-full opacity-10 blur-3xl animate-glow"
              style={{ animationDelay: "2s" }}
            ></div>
            <div className="absolute inset-0 hero-gradient"></div>
          </div>

          <div className="relative z-10 max-w-2xl w-full text-center animate-scale-in">
            <div className="glass-card rounded-3xl p-12 border border-white/10 shadow-2xl">
              <div className="mb-8">
                <div className="text-6xl mb-6 animate-float">
                  <span className="text-red-500 drop-shadow-lg filter">⚠️</span>
                </div>
                <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-orange-500 mb-4">
                  {statusCode}
                </h1>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Server Error
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed">
                  {message}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Link
                  href="/"
                  className="btn-primary px-8 py-3.5 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 border-none shadow-red-900/20"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Go Home
                </Link>

                <button
                  onClick={() => window.location.reload()}
                  className="btn-secondary px-8 py-3.5 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Try Again
                </button>
              </div>

              {isDevelopment && stack && (
                <div className="mt-8 text-left animate-slide-up">
                  <details className="bg-black/40 border border-white/10 rounded-xl overflow-hidden group">
                    <summary className="cursor-pointer font-medium text-gray-300 p-4 hover:bg-white/5 transition-colors flex items-center justify-between select-none">
                      <span>Stack Trace (Development Only)</span>
                      <svg
                        className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </summary>
                    <pre className="text-xs text-red-300/80 p-4 overflow-x-auto whitespace-pre-wrap font-mono border-t border-white/5 bg-black/20">
                      {stack}
                    </pre>
                  </details>
                </div>
              )}
            </div>

            <div className="mt-8 text-gray-500 text-sm">
              If this problem persists, please{" "}
              <Link
                href="/contact"
                className="text-red-400 hover:text-red-300 underline transition-colors"
              >
                contact support
              </Link>
              .
            </div>
          </div>
        </div>
      </Body>
    </Page>
  );
}
