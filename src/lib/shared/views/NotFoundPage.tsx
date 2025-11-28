import Body from "../components/Body";
import Head from "../components/Head";
import Link from "../components/Link";
import Page from "../components/Page";
interface NotFoundPageProps {
  url?: string;
}

export default function NotFoundPage({ url }: NotFoundPageProps) {
  return (
    <Page>
      <Head>
        <title>404 - Page Not Found</title>
        <meta
          name="description"
          content="The page you're looking for doesn't exist"
        />
      </Head>
      <Body>
        <div className="relative min-h-screen overflow-hidden bg-black text-white flex flex-col justify-center items-center px-4 font-sans">
          {/* Animated Background */}
          <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 grid-pattern opacity-30"></div>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500 rounded-full opacity-20 blur-3xl animate-glow"></div>
            <div
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full opacity-10 blur-3xl animate-glow"
              style={{ animationDelay: "2s" }}
            ></div>
            <div className="absolute inset-0 hero-gradient"></div>
          </div>

          <div className="relative z-10 max-w-lg w-full text-center animate-scale-in">
            <div className="glass-card rounded-3xl p-12 border border-white/10 shadow-2xl">
              <div className="mb-8">
                <h1 className="text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 mb-4 animate-float">
                  404
                </h1>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Page Not Found
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed">
                  {url ? (
                    <>
                      The page <span className="text-orange-400">"{url}"</span>{" "}
                      you're looking for doesn't exist.
                    </>
                  ) : (
                    "The page you're looking for doesn't exist."
                  )}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/"
                  className="btn-primary px-8 py-3.5 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-2 w-full sm:w-auto"
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
                  onClick={() => window.history.back()}
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
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Go Back
                </button>
              </div>
            </div>
            <div className="mt-8 text-gray-500 text-sm">
              If you believe this is an error, please{" "}
              <Link
                href="/contact"
                className="text-orange-400 hover:text-orange-300 underline transition-colors"
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
