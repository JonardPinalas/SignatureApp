import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import NavBar from "../components/NavBar";

const AdminDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [userCount, setUserCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [admin, setAdmin] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      setNotification({ message: "Loading admin dashboard...", type: "info" });

      // Check admin session
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setNotification({ message: "You must be logged in as admin.", type: "error" });
        navigate("/login");
        return;
      }

      // Check role
      const { data: profile, error: profileError } = await supabase.from("users").select("role, full_name").eq("id", user.id).single();

      if (profileError || profile?.role !== "admin") {
        setNotification({ message: "Access denied. Admins only.", type: "error" });
        navigate("/user/dashboard");
        return;
      }
      setAdmin(profile);

      // Fetch user count
      const { count: usersCount } = await supabase.from("users").select("id", { count: "exact", head: true });
      setUserCount(usersCount || 0);

      // Fetch document count
      const { count: docsCount } = await supabase.from("documents").select("id", { count: "exact", head: true });
      setDocumentCount(docsCount || 0);

      setLoading(false);
      setNotification({ message: "", type: "" });
    };

    fetchAdminData();
  }, [navigate]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--brand-bg-light)" }}>
      <NavBar />
      <div style={{ paddingTop: "90px", maxWidth: 1200, margin: "0 auto" }}>
        {notification.message && <Notification message={notification.message} type={notification.type} />}

        <h1
          style={{
            fontSize: "3em",
            fontWeight: 800,
            color: "var(--brand-heading)",
            marginBottom: 10,
            marginTop: 30,
          }}
        >
          Admin Dashboard
        </h1>
        <p style={{ color: "var(--brand-text-light)", fontSize: "1.2em" }}>Welcome{admin?.full_name ? `, ${admin.full_name}` : ""}! Manage users, documents, and platform settings.</p>

        {loading ? (
          <div style={{ padding: "3em", textAlign: "center", color: "var(--brand-text-light)" }}>Loading dashboard data...</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "2em",
              marginTop: "2em",
            }}
          >
            <div
              style={{
                background: "var(--brand-card)",
                borderRadius: 20,
                padding: "2em",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                textAlign: "center",
              }}
            >
              <h2 style={{ fontSize: "2em", fontWeight: 700, color: "var(--brand-heading)" }}>Users</h2>
              <div style={{ fontSize: "3em", fontWeight: 800, margin: "0.5em 0" }}>{userCount}</div>
              <Link
                to="/admin/users"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  padding: "0.5em 1.5em",
                  borderRadius: 999,
                  background: "var(--color-primary)",
                  color: "#fff",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Manage Users
              </Link>
            </div>
            <div
              style={{
                background: "var(--brand-card)",
                borderRadius: 20,
                padding: "2em",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                textAlign: "center",
              }}
            >
              <h2 style={{ fontSize: "2em", fontWeight: 700, color: "var(--brand-heading)" }}>Documents</h2>
              <div style={{ fontSize: "3em", fontWeight: 800, margin: "0.5em 0" }}>{documentCount}</div>
              <Link
                to="/admin/reports"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  padding: "0.5em 1.5em",
                  borderRadius: 999,
                  background: "var(--color-secondary)",
                  color: "#fff",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View Reports
              </Link>
            </div>
            <div
              style={{
                background: "var(--brand-card)",
                borderRadius: 20,
                padding: "2em",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                textAlign: "center",
              }}
            >
              <h2 style={{ fontSize: "2em", fontWeight: 700, color: "var(--brand-heading)" }}>Settings</h2>
              <div style={{ fontSize: "1.5em", margin: "1em 0", color: "var(--brand-text-light)" }}>Platform configuration and controls</div>
              <Link
                to="/admin/settings"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  padding: "0.5em 1.5em",
                  borderRadius: 999,
                  background: "var(--color-primary-light)",
                  color: "#fff",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Go to Settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
