import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: AuthPending,
  component: AuthenticatedRoute,
});

function AuthenticatedRoute() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data.user) {
          void navigate({ to: "/auth", replace: true });
          return;
        }
        setAuthenticated(true);
      })
      .catch(() => {
        if (active) void navigate({ to: "/auth", replace: true });
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  if (!authenticated) return <AuthPending />;
  return <Outlet />;
}

function AuthPending() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div role="status" aria-live="polite" className="meta-mono">
        Verificando acesso…
      </div>
    </div>
  );
}
