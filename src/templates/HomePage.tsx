import { Page, Head, Body } from "arcanajs";

export default function HomePage() {
  return (
    <Page>
      <Head>
        <title>Welcome to ArcanaJS</title>
        <meta
          name="description"
          content="A modern React framework with Tailwind CSS v4"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Body>
        <div className="relative min-h-screen overflow-hidden bg-black text-white">
          {/* Animated Background */}
          <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Grid Pattern */}
            <div className="absolute inset-0 grid-pattern opacity-30"></div>
            <div className="absolute inset-0 grid-pattern opacity-30"></div>

            {/* Animated Orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500 rounded-full opacity-20 blur-3xl animate-glow"></div>
            <div
              className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500 rounded-full opacity-15 blur-3xl animate-glow"
              style={{ animationDelay: "2s" }}
            ></div>
            <div
              className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl animate-glow"
              style={{ animationDelay: "4s" }}
            ></div>

            {/* Radial Gradient Accent */}
            <div className="absolute inset-0 hero-gradient"></div>
          </div>

          <div className="relative z-10">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 nav-blur animate-slide-down border-b border-white/5 backdrop-blur-sm">
              <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 group cursor-pointer">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-full blur-lg opacity-40 group-hover:opacity-100 transition-opacity"></div>
                    <img
                      src="arcanajs.png"
                      alt="ArcanaJS Logo"
                      className="relative w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="hidden md:flex space-x-8">
                  <a
                    href="#features"
                    className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    Features
                  </a>
                  <a
                    href="#docs"
                    className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    Docs
                  </a>
                  <a
                    href="#examples"
                    className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    Examples
                  </a>
                </div>
              </div>
            </nav>

            {/* Hero Section */}
            <main className="pt-32 pb-12 px-4 sm:px-6 lg:px-8">
              <div className="max-w-5xl mx-auto text-center">
                <div className="glass-card rounded-3xl p-8 md:p-12 mb-12 animate-scale-in border-white/10">
                  <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight drop-shadow-2xl">
                    Welcome to <span className="gradient-text">ArcanaJS</span>
                  </h1>
                  <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto text-balance font-light leading-relaxed">
                    A modern React framework with server-side rendering and
                    Tailwind CSS v4 support. Build fast, beautiful applications
                    with zero configuration.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button className="btn-primary px-8 py-3.5 text-lg font-semibold rounded-xl inline-flex items-center justify-center gap-2">
                      Get Started
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
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </button>
                    <button className="btn-secondary px-8 py-3.5 text-lg font-semibold rounded-xl inline-flex items-center justify-center gap-2">
                      View Examples
                    </button>
                  </div>
                </div>

                {/* Features Grid */}
                <section
                  id="features"
                  className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
                >
                  <div className="glass-card rounded-2xl p-8 feature-card text-center group">
                    <div className="w-14 h-14 bg-orange-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform border border-orange-500/20">
                      <svg
                        className="w-7 h-7 text-orange-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">
                      Fast SSR
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Server-side rendering for optimal performance and SEO.
                    </p>
                  </div>

                  <div className="glass-card rounded-2xl p-8 feature-card text-center group">
                    <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform border border-purple-500/20">
                      <svg
                        className="w-7 h-7 text-purple-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                      TypeScript
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Built-in TypeScript support for better developer
                      experience.
                    </p>
                  </div>

                  <div className="glass-card rounded-2xl p-8 feature-card text-center group">
                    <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform border border-blue-500/20">
                      <svg
                        className="w-7 h-7 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h4a2 2 0 002-2V9a2 2 0 00-2-2H7a2 2 0 00-2 2v6a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                      Tailwind v4
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Latest Tailwind CSS with CSS-first configuration.
                    </p>
                  </div>

                  <div className="glass-card rounded-2xl p-8 feature-card text-center group">
                    <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform border border-green-500/20">
                      <svg
                        className="w-7 h-7 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">
                      Hot Reload
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Instant updates during development for faster iteration.
                    </p>
                  </div>

                  <div className="glass-card rounded-2xl p-8 feature-card text-center group">
                    <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform border border-red-500/20">
                      <svg
                        className="w-7 h-7 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7zm0 0V5a2 2 0 012-2h6l2 2h6a2 2 0 012 2v2H3z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">
                      File-based Routing
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Intuitive routing based on your file structure.
                    </p>
                  </div>

                  <div className="glass-card rounded-2xl p-8 feature-card text-center group">
                    <div className="w-14 h-14 bg-indigo-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform border border-indigo-500/20">
                      <svg
                        className="w-7 h-7 text-indigo-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                      Zero Config
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Get started immediately with sensible defaults.
                    </p>
                  </div>
                </section>

                {/* Code Example */}
                <section
                  id="examples"
                  className="glass-card rounded-2xl p-8 text-left border-white/10"
                >
                  <h2 className="text-2xl font-bold text-white mb-6 text-center">
                    Quick Start
                  </h2>
                  <div className="bg-black/50 rounded-xl p-6 text-sm font-mono text-gray-300 overflow-x-auto border border-white/10 shadow-inner">
                    <div className="mb-4">
                      <div className="text-gray-500 mb-1">
                        # Create a new folder
                      </div>
                      <div className="text-orange-400">
                        mkdir my-app cd my-app
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="text-gray-500 mb-1">
                        # Initialize a new project
                      </div>
                      <div className="text-orange-400">npx arcanajs init</div>
                    </div>
                    <div className="mb-4">
                      <div className="text-gray-500 mb-1">
                        # Install dependencies
                      </div>
                      <div className="text-white">npm install</div>
                    </div>
                    <div className="mb-4">
                      <div className="text-gray-500 mb-1">
                        # Start development server
                      </div>
                      <div className="text-white">npm run dev</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">
                        # Build for production
                      </div>
                      <div className="text-white">npm run build</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">
                        # Start production server
                      </div>
                      <div className="text-white">npm start</div>
                    </div>
                  </div>
                </section>
              </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 mt-12 relative z-10 bg-black/20 backdrop-blur-md">
              <div className="container mx-auto px-6 py-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-gray-500 text-sm">
                    &copy; 2025 ArcanaJS. All rights reserved.
                  </div>
                  <div className="flex gap-6 text-gray-500 text-sm">
                    <a href="#" className="hover:text-white transition-colors">
                      GitHub
                    </a>
                    <a href="#" className="hover:text-white transition-colors">
                      Docs
                    </a>
                    <a href="#" className="hover:text-white transition-colors">
                      Community
                    </a>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </Body>
    </Page>
  );
}
