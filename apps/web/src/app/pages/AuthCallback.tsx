import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../auth";
import type { UserApiRecord } from "../api";

export default function AuthCallback() {
  const { completeOAuth } = useAuth();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("accessToken");
    const returnTo = params.get("returnTo") || "/workspace";
    const encodedUser = params.get("user");

    if (!accessToken || !encodedUser) {
      setFailed(true);
      return;
    }

    try {
      const user = JSON.parse(base64UrlDecode(encodedUser)) as UserApiRecord;
      completeOAuth({
        user,
        accessToken,
      });
      setRedirectTo(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/workspace");
    } catch {
      setFailed(true);
    }
  }, [completeOAuth]);

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  if (failed) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] text-gray-400">
      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.8} />
      nomduchat
    </div>
  );
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return decodeURIComponent(
    Array.from(window.atob(padded))
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
}
