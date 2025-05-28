import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import NavBar from "./pages/components/NavBar";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboardPage from "./pages/user/UserDashboardPage";
import MyDocumentsPage from "./pages/user/MyDocumentsPage";
import DocumentUploadPage from "./pages/user/DocumentUploadPage";
import DocumentDetailsPage from "./pages/user/DocumentDetailsPage";
import SignatureRequestsPage from "./pages/user/SignatureRequestsListPage";
import MyProfilePage from "./pages/MyProfilePage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import ManageAuditLogsPage from "./pages/admin/ManageAuditLogsPage";
import ManageUsersPage from "./pages/admin/ManageUsersPage";
import ReportsPage from "./pages/admin/ReportsPage";
import AnomaliesPage from "./pages/admin/AnomaliesPage";
import AdminRecordEdit from "./pages/admin/AdminRecordEdit";

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
              // Styled Email Verified Page
              <div
                className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 font-inter"
                style={{
                  backgroundColor: "var(--brand-bg-light)",
                  backgroundImage: "linear-gradient(135deg, var(--brand-bg-light), var(--brand-bg-dark))",
                  color: "var(--brand-text)",
                }}
              >
                <div className="bg-[var(--brand-card)] rounded-2xl shadow-xl p-8 md:p-12 text-center max-w-md w-full animate-fade-in-up">
                  <h1 className="text-4xl font-extrabold text-[var(--brand-heading)] mb-4 drop-shadow-md">Email Verified!</h1>
                  <p className="text-lg text-[var(--brand-text-light)] mb-6 leading-relaxed">Your email has been successfully verified. You can now securely log in.</p>
                  <Link
                    to="/login"
                    className="inline-block py-3 px-8 rounded-full shadow-lg font-bold text-lg
                               bg-gradient-to-br from-[var(--color-button-primary)] to-[var(--color-button-primary-hover)]
                               text-white transition-all duration-300 ease-out hover:from-[var(--color-button-primary-hover)]
                               hover:to-[var(--color-button-primary)] hover:translate-y-[-2px] hover:shadow-xl"
                  >
                    Go to Login
                  </Link>
                </div>
              </div>
            }
          />
          <Route
            path="/access-denied"
            element={
              // Styled Access Denied Page
              <div
                className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 font-inter"
                style={{
                  backgroundColor: "var(--brand-bg-light)",
                  backgroundImage: "linear-gradient(135deg, var(--brand-bg-light), var(--brand-bg-dark))",
                  color: "var(--brand-text)",
                }}
              >
                <div className="bg-[var(--brand-card)] rounded-2xl shadow-xl p-8 md:p-12 text-center max-w-md w-full animate-fade-in-up">
                  <h1 className="text-4xl font-extrabold text-[var(--brand-heading)] mb-4 drop-shadow-md">Access Denied</h1>
                  <p className="text-lg text-[var(--brand-text-light)] mb-6 leading-relaxed">You do not have permission to view this page. Please log in with appropriate credentials.</p>
                  <Link
                    to="/login"
                    className="inline-block py-3 px-8 rounded-full shadow-lg font-bold text-lg
                               bg-gradient-to-br from-[var(--color-button-primary)] to-[var(--color-button-primary-hover)]
                               text-white transition-all duration-300 ease-out hover:from-[var(--color-button-primary-hover)]
                               hover:to-[var(--color-button-primary)] hover:translate-y-[-2px] hover:shadow-xl"
                  >
                    Go to Login
                  </Link>
                </div>
              </div>
            }
          />

          {/* Authenticated Routes */}
          <Route path="/user/dashboard" element={<UserDashboardPage />} />
          <Route path="/user/documents" element={<MyDocumentsPage />} />
          <Route path="/user/documents/upload" element={<DocumentUploadPage />} />
          <Route path="/user/documents/:id" element={<DocumentDetailsPage />} />
          <Route path="/user/signature-requests" element={<SignatureRequestsPage />} />
          <Route path="/user/profile" element={<MyProfilePage />} />

          {/* admin routes */}
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/audit" element={<ManageAuditLogsPage />} />
          <Route path="/admin/manage-users" element={<ManageUsersPage />} />
          <Route path="/admin/reports" element={<ReportsPage />} />
          <Route path="/admin/anomalies" element={<AnomaliesPage />} />
          <Route path="/admin/master-edit" element={<AdminRecordEdit />} />

          {/* 404 - Page Not Found */}
          <Route
            path="*"
            element={
              // Styled 404 Page
              <div
                className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 font-inter"
                style={{
                  backgroundColor: "var(--brand-bg-light)",
                  backgroundImage: "linear-gradient(135deg, var(--brand-bg-light), var(--brand-bg-dark))",
                  color: "var(--brand-text)",
                }}
              >
                <div className="bg-[var(--brand-card)] rounded-2xl shadow-xl p-8 md:p-12 text-center max-w-md w-full animate-fade-in-up">
                  <h1 className="text-5xl md:text-6xl font-extrabold text-[var(--brand-heading)] mb-4 drop-shadow-md">404</h1>
                  <p className="text-xl md:text-2xl text-[var(--brand-text-light)] mb-6 leading-relaxed">Oops! The page you're looking for doesn't exist.</p>
                  <Link
                    to="/"
                    className="inline-block py-3 px-8 rounded-full shadow-lg font-bold text-lg
                               bg-gradient-to-br from-[var(--color-button-primary)] to-[var(--color-button-primary-hover)]
                               text-white transition-all duration-300 ease-out hover:from-[var(--color-button-primary-hover)]
                               hover:to-[var(--color-button-primary)] hover:translate-y-[-2px] hover:shadow-xl"
                  >
                    Go Home
                  </Link>
                </div>
              </div>
            }
          />
        </Routes>
      </div>
    </>
  );
}

export default AppRoutes;
