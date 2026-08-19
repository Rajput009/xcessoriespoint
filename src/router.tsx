import { createContext, useContext, useEffect, useState, type ReactNode, type MouseEvent } from "react";

/** Tiny history-based router — clean URLs, no hash. */

interface RouterState {
  path: string;
  query: URLSearchParams;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterState>({
  path: "/",
  query: new URLSearchParams(),
  navigate: () => {},
});

function parse(): { path: string; query: URLSearchParams } {
  return {
    path: window.location.pathname || "/",
    query: new URLSearchParams(window.location.search),
  };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(parse);

  useEffect(() => {
    // Migrate legacy hash URLs (#/shop) to clean URLs
    if (window.location.hash.startsWith("#/")) {
      const clean = window.location.hash.slice(1);
      window.history.replaceState({}, "", clean);
      setState(parse());
    }
    const onPop = () => setState(parse());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setState(parse());
    window.scrollTo({ top: 0 });
  };

  return (
    <RouterContext.Provider value={{ ...state, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}

export function Link({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onClick?.();
    navigate(to);
  };
  return (
    <a href={to} onClick={handle} className={className}>
      {children}
    </a>
  );
}
