/**
 * Global type declarations for ArcanaJS
 * This file provides type support for CSS imports in projects using ArcanaJS
 */

/// <reference types="react" />
/// <reference path="./express.d.ts" />

// CSS Module declarations
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// SCSS declarations
declare module "*.scss" {
  const content: { [className: string]: string };
  export default content;
}

declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

// SASS declarations
declare module "*.sass" {
  const content: { [className: string]: string };
  export default content;
}

declare module "*.module.sass" {
  const classes: { [key: string]: string };
  export default classes;
}

// LESS declarations
declare module "*.less" {
  const content: { [className: string]: string };
  export default content;
}

declare module "*.module.less" {
  const classes: { [key: string]: string };
  export default classes;
}

// Image file declarations
declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.gif" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare module "*.webp" {
  const value: string;
  export default value;
}

// Font file declarations
declare module "*.woff" {
  const value: string;
  export default value;
}

declare module "*.woff2" {
  const value: string;
  export default value;
}

declare module "*.ttf" {
  const value: string;
  export default value;
}

declare module "*.eot" {
  const value: string;
  export default value;
}
