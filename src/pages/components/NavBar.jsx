// src/components/NavBar.jsx
import React, { useEffect, useState, forwardRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";

const NavBar = forwardRef((props, ref) => {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false); // New state for dropdown visibility
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase.from("users").select("role").eq("id", userId).single();

    if (error) {
      console.error("Error fetching user role for NavBar:", error);
      setUserRole(null);
    } else if (data) {
      setUserRole(data.role);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
    } else {
      navigate("/login");
    }
  };

  // Toggle dropdown visibility
  const toggleSettingsDropdown = () => {
    setShowSettingsDropdown(!showSettingsDropdown);
  };

  // Close dropdown if clicked outside (optional, but good UX)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettingsDropdown && !event.target.closest(".settings-dropdown-container")) {
        setShowSettingsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettingsDropdown]);

  return (
    <nav style={styles.navbar} ref={ref}>
      <div style={styles.logoContainer}>
        <Link to={userRole ? `/${userRole}/dashboard` : "/user/dashboard"} style={styles.logoLink}>
          SignSeal
        </Link>
      </div>
      <div style={styles.linksContainer}>
        <Link to="/user/dashboard" style={styles.navLink}>
          Dashboard
        </Link>
        {/* Uncomment these links as you implement the corresponding pages. */}
        {/* <Link to="/report-incident" style={styles.navLink}>Report Incident</Link> */}
        <Link to="/user/documents" style={styles.navLink}>
          My Documents
        </Link>
        <Link to="/user/signature-requests" style={styles.navLink}>
          Signatures
        </Link>

        {/* Admin-specific links */}
        {userRole === "admin" && (
          <>
            <Link to="/admin/dashboard" style={styles.navLink}>
              Admin Dashboard
            </Link>
            {/* Uncomment as you implement these pages */}
            {/* <Link to="/admin/users" style={styles.navLink}>User Management</Link> */}
            {/* <Link to="/admin/audit-logs" style={styles.navLink}>Audit Logs</Link> */}
          </>
        )}

        {/* Settings Dropdown */}
        <div style={styles.settingsContainer} className="settings-dropdown-container">
          <button onClick={toggleSettingsDropdown} style={styles.settingsButton}>
            Settings
            <span style={styles.dropdownArrow}>{showSettingsDropdown ? "▲" : "▼"}</span>
          </button>
          {showSettingsDropdown && (
            <div style={styles.dropdownMenu}>
              <Link
                to="/my-profile" // Assuming you'll uncomment this route later
                style={styles.dropdownItem}
                onClick={() => setShowSettingsDropdown(false)} // Close dropdown on click
              >
                Profile
              </Link>
              <button onClick={handleLogout} style={styles.dropdownItemButton}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
});

// Define your styles to match the Landing page's aesthetic
const styles = {
  navbar: {
    backgroundColor: "var(--brand-bg-light)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    padding: "16px 40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid var(--brand-border)",
    position: "fixed",
    width: "100%",
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  logoContainer: {
    fontSize: "2em",
    fontWeight: "800",
  },
  logoLink: {
    color: "var(--color-button-primary)",
    textDecoration: "none",
  },
  linksContainer: {
    display: "flex",
    alignItems: "center",
    gap: "30px",
  },
  navLink: {
    color: "var(--brand-text)",
    textDecoration: "none",
    fontSize: "1.05em",
    fontWeight: "500",
    transition: "color 0.3s ease-in-out",
  },
  // New styles for settings dropdown
  settingsContainer: {
    position: "relative", // Essential for positioning the dropdown menu
    display: "inline-block",
  },
  settingsButton: {
    backgroundColor: "transparent",
    color: "var(--brand-text)", // Match other nav links
    border: "none",
    padding: "0", // No padding, let dropdown item handle it
    fontSize: "1.05em",
    fontWeight: "500",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "5px", // Space between "Settings" text and arrow
    transition: "color 0.3s ease-in-out",
    // Hover effect (requires direct manipulation or CSS)
    "&:hover": {
      color: "var(--color-button-primary)", // Example hover color
    },
  },
  dropdownArrow: {
    fontSize: "0.7em", // Smaller arrow
    lineHeight: "1",
    transform: "translateY(1px)", // Slight adjustment for vertical alignment
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%", // Position right below the button
    right: "0", // Align to the right of the button
    backgroundColor: "var(--brand-bg-light)", // Same background as navbar
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)", // More prominent shadow for dropdown
    borderRadius: "8px",
    minWidth: "150px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden", // Ensures rounded corners apply to content
    marginTop: "10px", // Space between button and dropdown
    zIndex: 1001, // Ensure dropdown is above other content
    border: "1px solid var(--brand-border)", // Light border
  },
  dropdownItem: {
    padding: "12px 20px",
    color: "var(--brand-text)",
    textDecoration: "none",
    fontSize: "1em",
    fontWeight: "400",
    transition: "background-color 0.2s ease-in-out, color 0.2s ease-in-out",
    cursor: "pointer",
    textAlign: "left",
    borderBottom: "1px solid #eee", // Separator between items
    "&:last-child": {
      borderBottom: "none", // No border for the last item
    },
    // Hover effect for dropdown items
    "&:hover": {
      backgroundColor: "var(--color-button-primary)", // Background on hover
      color: "white", // Text color on hover
    },
  },
  dropdownItemButton: {
    padding: "12px 20px",
    color: "var(--brand-text)",
    textDecoration: "none",
    fontSize: "1em",
    fontWeight: "400",
    transition: "background-color 0.2s ease-in-out, color 0.2s ease-in-out",
    cursor: "pointer",
    textAlign: "left",
    border: "none", // Remove default button border
    backgroundColor: "transparent", // Make button background transparent by default
    width: "100%", // Make button take full width of dropdown
    // Hover effect for dropdown items
    "&:hover": {
      backgroundColor: "var(--color-button-primary)",
      color: "white",
    },
  },
};

export default NavBar;
