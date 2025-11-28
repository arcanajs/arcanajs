import React from "react";
import  useRouter  from "../hooks/useRouter";

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  prefetch?: boolean;
}

const Link: React.FC<LinkProps> = ({
  href,
  children,
  prefetch = false,
  ...props
}) => {
  const { navigateTo, navigateToAsync } = useRouter();

  const isExternal = /^https?:\/\//.test(href);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (isExternal) {
      // Open external links in a new tab
      window.open(href, "_blank", "noopener,noreferrer");
    } else if (navigateToAsync) {
      await navigateToAsync(href);
    } else {
      navigateTo(href);
    }
  };

  const handleMouseEnter = () => {
    if (prefetch && !isExternal) {
      // Prefetch using HEAD request to warm cache
      fetch(href, { method: "HEAD" }).catch(() => {});
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children}
    </a>
  );
};
export default Link;
