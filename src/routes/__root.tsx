import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-accent/5 blur-[120px] -z-10" />
      <div className="max-w-md w-full p-12 premium-glass rounded-[3.5rem] border border-white/5 text-center space-y-8 shadow-2xl">
         <div className="flex flex-col items-center gap-4">
            <h1 className="text-9xl font-black tracking-tighter premium-gradient-text leading-none">404</h1>
            <div className="w-12 h-1 w-1 bg-primary rounded-full animate-bounce" />
         </div>
         <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase italic">Vector Lost.</h2>
            <p className="text-muted-foreground font-medium leading-relaxed opacity-60">
              The coordinates you are seeking do not exist in the EduNook constellation.
            </p>
         </div>
         <div className="pt-4">
           <Link
             to="/"
             className="inline-flex items-center justify-center w-full rounded-2xl bg-white px-8 py-5 text-sm font-black text-black transition-all hover:scale-105 active:scale-95 shadow-xl"
           >
             Return to Station
           </Link>
         </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" },
      { title: "EduNook — Modern Education Platform" },
      { name: "description", content: "Learn and teach with EduNook. Browse courses, create content, and connect with educators." },
      { name: "author", content: "EduNook" },
      { property: "og:title", content: "EduNook — Modern Education Platform" },
      { property: "og:description", content: "Learn and teach with EduNook. Browse courses, create content, and connect with educators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#050505" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "preconnect",
        href: "https://res.cloudinary.com",
        crossOrigin: "anonymous",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Security & Isolation Meta Tags (Fixed prop names for React) */}
        <meta httpEquiv="Cross-Origin-Opener-Policy" content="same-origin" />
        <meta httpEquiv="Cross-Origin-Embedder-Policy" content="require-corp" />
        
        {/* Resource Hints */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />

        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          media="print"
          onLoad={(e) => { e.currentTarget.media = 'all' }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          />
        </noscript>
      </head>
      <body className="bg-[#050505] text-white antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
