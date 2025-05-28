import React, { useEffect, useState, forwardRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";

const NavBar = forwardRef((props, ref) => {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
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

  const toggleSettingsDropdown = () => {
    setShowSettingsDropdown(!showSettingsDropdown);
  };

  // Close dropdown if clicked outside
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

  // Define role-based nav links
  const navLinks = {
    user: [
      { to: "/user/dashboard", label: "Dashboard" },
      { to: "/user/documents", label: "My Documents" },
      { to: "/user/signature-requests", label: "Signatures" },
    ],
    admin: [
      { to: "/admin/dashboard", label: "Admin Dashboard" },
      { to: "/admin/manage-users", label: "Manage Users" },
      { to: "/admin/reports", label: "Reports" },
      { to: "/admin/audit", label: "Audit Logs" },
      { to: "/admin/anomalies", label: "Reported Anomalies" },
      { to: "/admin/master-edit", label: "Master Editor" },
    ],
    // Add more roles if needed
  };

  // Choose links based on role
  let linksToShow = [];
  if (userRole === "admin") {
    linksToShow = navLinks.admin;
  } else if (userRole === "user") {
    linksToShow = navLinks.user;
  }

  return (
    <nav
      ref={ref}
      className="bg-[var(--brand-bg-light)] shadow-md py-4 px-10 flex justify-between items-center
                 border-b border-[var(--brand-border)] fixed w-full top-0 left-0 z-50 transition-all duration-300"
    >
      {/* Logo */}
      <div className="text-4xl font-extrabold">
        <Link to={userRole ? `/${userRole}/dashboard` : "/user/dashboard"} className="text-[var(--color-button-primary)] no-underline drop-shadow-sm">
          SignSeal
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center space-x-8">
        {linksToShow.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-[var(--brand-text)] no-underline text-lg font-medium transition-colors duration-300
                         hover:text-[var(--color-text-accent-light)]"
          >
            {link.label}
          </Link>
        ))}

        {/* Settings Dropdown */}
        <div className="relative inline-block settings-dropdown-container">
          <button
            onClick={toggleSettingsDropdown}
            className="bg-transparent border-none text-[var(--brand-text)] text-lg font-medium cursor-pointer
                       flex items-center gap-1 transition-colors duration-300 focus:outline-none
                       hover:text-[var(--color-text-accent-light)]"
          >
            Settings
            <span className={`text-xs leading-none transform transition-transform duration-300 ${showSettingsDropdown ? "rotate-180" : "rotate-0"}`}>▼</span>
          </button>
          {showSettingsDropdown && (
            <div
              className="absolute top-full right-0 bg-[var(--brand-card)] shadow-lg rounded-lg
                         min-w-[160px] flex flex-col overflow-hidden mt-3 z-50
                         border border-[var(--brand-border-light)] animate-fade-in-up origin-top-right"
            >
              <Link
                to="/user/profile"
                className="py-3 px-5 text-[var(--brand-text)] no-underline text-base font-normal
                           transition-all duration-200 hover:bg-[var(--color-button-primary)] hover:text-white"
                onClick={() => setShowSettingsDropdown(false)}
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="py-3 px-5 text-[var(--brand-text)] no-underline text-base font-normal
                           transition-all duration-200 hover:bg-[var(--color-button-primary)] hover:text-white
                           border-none bg-transparent w-full text-left"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
});

export default NavBar;
