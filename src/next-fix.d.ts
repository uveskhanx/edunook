/**
 * GLOBAL TYPE FIX FOR EDUNOOK
 * This file helps the IDE resolve Next.js modules when the local TypeScript server is out of sync.
 * This does NOT affect the production build, which correctly resolves these from node_modules.
 */

declare module 'next/link' {
  import { ReactNode, AnchorHTMLAttributes } from 'react';
  
  export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
    locale?: string | false;
    legacyBehavior?: boolean;
    children?: ReactNode; // Explicitly adding children for React 19 compatibility in IDE
  }

  export default function Link(props: LinkProps): JSX.Element;
}

declare module 'next/image' {
  import { ImgHTMLAttributes } from 'react';

  export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    width?: number | string;
    height?: number | string;
    fill?: boolean;
    loader?: any;
    quality?: number | string;
    priority?: boolean;
    loading?: 'eager' | 'lazy';
    placeholder?: 'blur' | 'empty' | string;
    blurDataURL?: string;
    unoptimized?: boolean;
    onLoadingComplete?: (result: { naturalWidth: number; naturalHeight: number }) => void;
  }

  export default function Image(props: ImageProps): JSX.Element;
}
