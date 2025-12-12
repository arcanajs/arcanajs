import React from "react";

/**
 * BodyProps - Props for the Body component
 */
export interface BodyProps {
  /** Body content */
  children: React.ReactNode;
  /** Additional CSS class for the body wrapper */
  className?: string;
  /** Body ID for styling/testing */
  id?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Reference to the body element */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Body - Page content wrapper component for ArcanaJS
 *
 * Use this component to wrap your page content. It provides semantic
 * structure and separation from the Head component.
 *
 * ## Why Use Body?
 *
 * 1. **Semantic Structure** - Clearly separates meta (Head) from content (Body)
 * 2. **Styling Hook** - Easy to apply global page styles
 * 3. **Layout Support** - Works with layouts for consistent page structure
 * 4. **SSR-Ready** - Consistent rendering between server and client
 *
 * @example
 * ```tsx
 * // Basic usage with Page and Head
 * import { Page, Head, Body } from 'arcanajs/client';
 *
 * export default function HomePage() {
 *   return (
 *     <Page>
 *       <Head>
 *         <title>Home</title>
 *       </Head>
 *       <Body>
 *         <header>...</header>
 *         <main>...</main>
 *         <footer>...</footer>
 *       </Body>
 *     </Page>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With styling
 * import { Page, Body } from 'arcanajs/client';
 *
 * export default function DarkPage() {
 *   return (
 *     <Page title="Dark Mode">
 *       <Body className="bg-gray-900 text-white min-h-screen">
 *         <div className="container mx-auto py-8">
 *           <h1>Welcome to the dark side</h1>
 *         </div>
 *       </Body>
 *     </Page>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Full page structure
 * import { Page, Head, Body, usePage, Link } from 'arcanajs/client';
 *
 * interface PageData {
 *   posts: Array<{ id: string; title: string }>;
 * }
 *
 * export default function BlogPage() {
 *   const { posts } = usePage<PageData>();
 *
 *   return (
 *     <Page>
 *       <Head>
 *         <title>Blog</title>
 *         <meta name="description" content="Latest articles" />
 *       </Head>
 *       <Body className="min-h-screen flex flex-col">
 *         <header className="border-b p-4">
 *           <nav>
 *             <Link href="/">Home</Link>
 *             <Link href="/blog">Blog</Link>
 *           </nav>
 *         </header>
 *
 *         <main className="flex-1 p-4">
 *           <h1>Latest Posts</h1>
 *           <ul>
 *             {posts.map(post => (
 *               <li key={post.id}>
 *                 <Link href={`/blog/${post.id}`}>{post.title}</Link>
 *               </li>
 *             ))}
 *           </ul>
 *         </main>
 *
 *         <footer className="border-t p-4 text-center">
 *           © 2025 My Blog
 *         </footer>
 *       </Body>
 *     </Page>
 *   );
 * }
 * ```
 */
const Body = React.forwardRef<HTMLDivElement, BodyProps>(
  ({ children, className, id, style }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        id={id}
        style={style}
        data-arcanajs-body
      >
        {children}
      </div>
    );
  }
);

Body.displayName = "Body";

export default Body;
