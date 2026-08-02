import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function ProtectedRoute({ children, allowedRole }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      // Check if logged in
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      // Get the user's role
      const { data: profile, error } = await supabase
        .from("users")
        .select("Role")
        .eq("auth_id", session.user.id)
        .single();

      if (!error && profile.Role === allowedRole) {
        setAuthorized(true);
      }

      setLoading(false);
    }

    checkAccess();
  }, [allowedRole]);

  if (loading) {
    return <h1>Loading...</h1>;
  }

  if (!authorized) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;