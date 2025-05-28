import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import NavBar from "../components/NavBar";
// You can use react-icons or your own SVGs
const FaUsers = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="16" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="8" cy="18" rx="6" ry="3" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="16" cy="18" rx="6" ry="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const FaFileAlt = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const FaCog = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 8.6 15a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 15 8.6a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15z"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const FaChartBar = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="12" width="4" height="8" stroke="currentColor" strokeWidth="2" />
    <rect x="9" y="8" width="4" height="12" stroke="currentColor" strokeWidth="2" />
    <rect x="15" y="4" width="4" height="16" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const FaHistory = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
    <path d="M3 12a9 9 0 1 1 9 9" stroke="currentColor" strokeWidth="2" />
    <polyline points="3 8 3 12 7 12" stroke="currentColor" strokeWidth="2" fill="none" />
    <line x1="12" y1="7" x2="12" y2="12" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="12" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const quickLinks = [
  {
    title: "Users",
    countKey: "userCount",
    icon: <FaUsers size={36} color="var(--color-primary)" />,
    to: "/admin/manage-users",
    desc: "Manage all platform users",
    bg: "var(--brand-card)",
  },
  {
    title: "Documents",
    countKey: "documentCount",
    icon: <FaFileAlt size={36} color="var(--color-secondary)" />,
    to: "/admin/master-edit",
    desc: "View and manage documents",
    bg: "var(--brand-card)",
  },
  {
    title: "Reports",
    icon: <FaChartBar size={36} color="var(--color-primary-light)" />,
    to: "/admin/reports",
    desc: "View platform reports",
    bg: "var(--brand-card)",
  },

  {
    title: "Audit Logs",
    icon: <FaHistory size={36} color="var(--color-secondary)" />,
    to: "/admin/audit",
    desc: "Review activity logs",
    bg: "var(--brand-card)",
  },
];

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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setNotification({ message: "You must be logged in as admin.", type: "error" });
        navigate("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase.from("users").select("role, full_name").eq("id", user.id).single();

      if (profileError || profile?.role !== "admin") {
        setNotification({ message: "Access denied. Admins only.", type: "error" });
        navigate("/user/dashboard");
        return;
      }
      setAdmin(profile);

      const { count: usersCount } = await supabase.from("users").select("id", { count: "exact", head: true });
      setUserCount(usersCount || 0);

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
            fontSize: "2.5em",
            fontWeight: 800,
            color: "var(--brand-heading)",
            marginBottom: 10,
            marginTop: 30,
          }}
        >
          Admin Dashboard
        </h1>
        <p style={{ color: "var(--brand-text-light)", fontSize: "1.2em" }}>
          Welcome{admin?.full_name ? `, ${admin.full_name}` : ""}! Here you can manage users, documents, reports, and platform settings.
        </p>

        <div
          style={{
            display: "flex",
            gap: "2em",
            margin: "2em 0 1em 0",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              background: "var(--brand-card)",
              borderRadius: 16,
              padding: "1.5em 2em",
              minWidth: 200,
              flex: 1,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: "1.1em", color: "var(--brand-text-light)" }}>Total Users</div>
            <div style={{ fontSize: "2.5em", fontWeight: 700, color: "var(--color-primary)" }}>{userCount}</div>
          </div>
          <div
            style={{
              background: "var(--brand-card)",
              borderRadius: 16,
              padding: "1.5em 2em",
              minWidth: 200,
              flex: 1,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: "1.1em", color: "var(--brand-text-light)" }}>Total Documents</div>
            <div style={{ fontSize: "2.5em", fontWeight: 700, color: "var(--color-secondary)" }}>{documentCount}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "3em", textAlign: "center", color: "var(--brand-text-light)" }}>Loading dashboard data...</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "2em",
              marginTop: "2em",
            }}
          >
            {quickLinks.map((link) => (
              <Link
                key={link.title}
                to={link.to}
                style={{
                  background: link.bg,
                  borderRadius: 20,
                  padding: "2em 1.5em",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  textAlign: "center",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "box-shadow 0.2s, transform 0.2s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ marginBottom: 10 }}>{link.icon}</div>
                <h2 style={{ fontSize: "1.5em", fontWeight: 700, color: "var(--brand-heading)", margin: 0 }}>{link.title}</h2>
                {link.countKey && <div style={{ fontSize: "2em", fontWeight: 800, margin: "0.5em 0" }}>{link.countKey === "userCount" ? userCount : documentCount}</div>}
                <div style={{ color: "var(--brand-text-light)", marginTop: 8 }}>{link.desc}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
