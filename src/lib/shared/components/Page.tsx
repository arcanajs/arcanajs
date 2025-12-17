import React from "react";
import Head from "./Head";

/**
 * PageProps - Props for the Page component
 */
export interface PageProps {
  /** Page content */
  children: React.ReactNode;
  /** Page title (shorthand for <Head><title>...</title></Head>) */
  title?: string;
  /** Page description (shorthand for meta description) */
  description?: string;
  /** Open Graph image URL */
  ogImage?: string;
  /** Canonical URL */
  canonical?: string;
  /** Additional CSS class for the page wrapper */
  className?: string;
  /** Page ID for styling/testing */
  id?: string;
}

/**
 * Page - Developer-facing page wrapper component for ArcanaJS
 *
 * Use this component as the root of your page views. It provides a clean
 * structure for organizing page meta tags and content.
 *
 * ## Page Structure
 *
 * ArcanaJS pages follow a simple pattern:
 * - `<Page>` - Root wrapper (this component)
 * - `<Head>` - Meta tags, title, links
 * - `<Body>` - Page content
 *
 * @example
 * ```tsx
 * // Basic usage
 * import { Page, Head, Body } from 'arcanajs/client';
 *
 * export default function HomePage() {
 *   return (
 *     <Page>
 *       <Head>
 *         <title>My Page</title>
 *         <meta name="description" content="Page description" />
 *       </Head>
 *       <Body>
 *         <h1>Welcome!</h1>
 *       </Body>
 *     </Page>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With shorthand props
 * import { Page, Body } from 'arcanajs/client';
 *
 * export default function AboutPage() {
 *   return (
 *     <Page
 *       title="About Us"
 *       description="Learn more about our company"
 *       ogImage="/images/about-og.jpg"
 *     >
 *       <Body>
 *         <h1>About Us</h1>
 *         <p>Our story...</p>
 *       </Body>
 *     </Page>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With usePage hook for server data
 * import { Page, Head, Body, usePage } from 'arcanajs/client';
 *
 * interface PageData {
 *   user: { name: string };
 * }
 *
 * export default function ProfilePage() {
 *   const { user } = usePage<PageData>();
 *
 *   return (
 *     <Page title={`${user.name}'s Profile`}>
 *       <Body>
 *         <h1>{user.name}</h1>
 *       </Body>
 *     </Page>
 *   );
 * }
 * ```
 */
const Page: React.FC<PageProps> = ({
  children,
  title,
  description,
  ogImage,
  canonical,
  className,
  id,
}) => {
  // Check if Head is provided in children, if not and we have meta props, create one
  const hasHeadProps = !!(title || description || ogImage || canonical);

  return (
    <div className={className} id={id} data-arcanajs-page>
      {hasHeadProps && (
        <Head>
          {title && <title>{title}</title>}
          {description && <meta name="description" content={description} />}
          {ogImage && <meta property="og:image" content={ogImage} />}
          {canonical && <link rel="canonical" href={canonical} />}
        </Head>
      )}
      {children}
    </div>
  );
};

export default Page;
