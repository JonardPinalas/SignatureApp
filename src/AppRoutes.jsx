import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import NavBar from "./pages/components/NavBar";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboardPage from "./pages/user/UserDashboardPage";
import 

function AppRoutes({ session }) {
  const location = useLocation();
  const [navBarHeight, setNavBarHeight] = useState(0);
  const navBarRef = useRef(null);

  const hideNavBarPaths = ["/", "/login", "/register", "/verify-email-success", "/access-denied"];

  const shouldShowNavBar = session && !hideNavBarPaths.includes(location.pathname);

  useEffect(() => {
    if (shouldShowNavBar && navBarRef.current) {
      setNavBarHeight(navBarRef.current.offsetHeight);
    } else {
      setNavBarHeight(0);
    }
  }, [shouldShowNavBar, location.pathname]);

  return (
    <>
      {shouldShowNavBar && <NavBar ref={navBarRef} />}
      <div style={{ paddingTop: `${navBarHeight}px` }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/verify-email-success"
            element={
              <div style={{ textAlign: "center", padding: "50px" }}>
                <h1>Email Verified!</h1>
                <p>
                  Your email has been successfully verified. You can now{" "}
                  <Link to="/login">login</Link>.
                </p>
              </div>
            }
          />
          <Route
            path="/access-denied"
            element={
              <div style={{ textAlign: "center", padding: "50px" }}>
                <h1>Access Denied</h1>
                <p>You do not have permission to view this page.</p>
                <Link to="/login">Go to Login</Link>
              </div>
            }
          />

          {/* Authenticated Routes */}
          <Route path="/user/dashboard" element={<UserDashboardPage />} />

          {/* 404 */}
          <Route
            path="*"
            element={
              <div style={{ textAlign: "center", padding: "50px" }}>
                <h1>404 - Page Not Found</h1>
                <p>The page you are looking for does not exist.</p>
                <Link to="/">Go Home</Link>
              </div>
            }
          />
        </Routes>
      </div>
    </>
  );
}

export default AppRoutes;
