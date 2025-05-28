import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Notification from "../components/Notification";
import { supabase } from "../../utils/supabaseClient";

const UserDashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [ownedDocuments, setOwnedDocuments] = useState({ length: 0 });
  const [pendingSignatures, setPendingSignatures] = useState({ length: 0 });
  const [completedSignatures, setCompletedSignatures] = useState({ length: 0 });
  const [notification, setNotification] = useState({ message: "", type: "" });

  // No longer needed with Tailwind hover variants
  // const [hoveredCard, setHoveredCard] = useState(null);
  // const [hoveredActionButton, setHoveredActionButton] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setNotification({ message: "Loading your dashboard...", type: "info" });

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setNotification({
          message: "You need to be logged in to view the dashboard.",
          type: "error",
        });
        navigate("/login");
        return;
      }
      setUser(user);
      setCurrentUserEmail(user.email);

      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        setNotification({ message: "Error loading your profile data.", type: "error" });
      } else if (userProfile) {
        setUserRole(userProfile.role);
        if (userProfile.role === "admin") {
          setNotification({ message: "Redirecting to Admin Dashboard...", type: "info" });
          navigate("/admin/dashboard");
          return;
        }
      }

      const { count: ownedDocsCount, error: ownedDocsError } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);

      if (ownedDocsError) {
        console.error("Error fetching owned documents count:", ownedDocsError);
        setNotification({ message: "Error loading your documents count.", type: "error" });
      }
      setOwnedDocuments({ length: ownedDocsCount || 0 });

      const { count: pendingReqsCount, error: pendingReqsError } = await supabase
        .from("signature_requests")
        .select("id", { count: "exact", head: true })
        .eq("signer_email", user.email)
        .eq("status", "pending");

      if (pendingReqsError) {
        console.error("Error fetching pending signatures count:", pendingReqsError);
        setNotification({ message: "Error loading pending signatures count.", type: "error" });
      }
      setPendingSignatures({ length: pendingReqsCount || 0 });

      const { count: completedReqsCount, error: completedReqsError } = await supabase
        .from("signature_requests")
        .select("id", { count: "exact", head: true })
        .eq("signer_email", user.email)
        .eq("status", "signed");

      if (completedReqsError) {
        console.error("Error fetching completed signatures count:", completedReqsError);
        setNotification({ message: "Error loading completed signatures count.", type: "error" });
      }
      setCompletedSignatures({ length: completedReqsCount || 0 });

      setLoading(false);
      if (
        !userError &&
        !profileError &&
        !ownedDocsError &&
        !pendingReqsError &&
        !completedReqsError
      ) {
        setNotification({ message: "Dashboard loaded!", type: "success" });
        setTimeout(() => setNotification({ message: "", type: "" }), 3000);
      }
    };

    fetchDashboardData();
  }, [navigate, currentUserEmail]);

  return (
    <div
      className="min-h-screen flex flex-col items-center p-4 transition-colors duration-300 font-inter"
      style={{
        backgroundColor: "var(--brand-bg-light)",
        backgroundImage: "linear-gradient(135deg, var(--brand-bg-light), var(--brand-bg-dark))",
        color: "var(--brand-text)",
      }}
    >
      {notification.message && (
        <Notification message={notification.message} type={notification.type} />
      )}

      {/* Hero Section */}
      <div
        className="w-full bg-gradient-to-br from-[var(--color-primary-dark)] to-[var(--color-secondary)] text-[var(--color-text-white)] py-24 md:py-32 text-center mb-16 shadow-xl rounded-b-3xl flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Subtle background glow for main section */}
        <div
          className="absolute -top-16 -left-16 w-64 h-64 rounded-full mix-blend-multiply filter blur-xl animate-blob -z-10"
          style={{ backgroundColor: "var(--color-button-primary)", opacity: 0.1 }}
        ></div>
        <div
          className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000 -z-10"
          style={{ backgroundColor: "var(--color-button-primary)", opacity: 0.1 }}
        ></div>

        <h1
          className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-5 leading-tight drop-shadow-lg animate-fade-in-up"
          style={{ color: "var(--color-text-white)" }}
        >
          Welcome, {user?.user_metadata?.full_name || user?.email || "User"}!
        </h1>
        <p
          className="text-lg md:text-xl lg:text-2xl mb-0 max-w-3xl leading-relaxed animate-fade-in-up delay-200"
          style={{ color: "var(--color-text-white-subtle)" }}
        >
          Your central hub for document management and signatures.
        </p>
      </div>

      {loading ? (
        <div className="text-center p-24 text-2xl text-[var(--brand-text-light)]">
          Loading dashboard data...
        </div>
      ) : (
        <div className="w-full max-w-7xl px-4 pb-16 box-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Section 1: My Uploaded Documents */}
            <div
              className="bg-[var(--brand-card)] rounded-2xl shadow-md p-8 border border-[var(--brand-border-light)]
                         flex flex-col items-center text-center relative overflow-hidden
                         transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg group"
            >
              <h2 className="text-3xl font-extrabold text-[var(--brand-heading)] mb-6 pb-4 border-b-2 border-[var(--brand-border)] w-full">
                My Documents
              </h2>
              <div className="my-8 flex flex-col items-center flex-grow">
                <span
                  className="text-7xl font-extrabold block mb-4 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent drop-shadow-md"
                >
                  {ownedDocuments.length}
                </span>
                <p className="text-xl text-[var(--brand-text-light)] leading-relaxed">
                  documents uploaded
                </p>
              </div>
              <Link
                to="/user/documents"
                className="inline-flex justify-center items-center w-auto
                           bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-primary)]
                           text-[var(--color-text-white)] border-none py-4 px-8 rounded-full font-bold text-lg
                           transition-all duration-300 ease-out shadow-md
                           hover:from-[var(--color-primary)] hover:to-[var(--color-primary-dark)] hover:translate-y-[-4px] hover:shadow-lg"
              >
                View All My Documents
              </Link>
            </div>

            {/* Section 2: Pending Signatures (Awaiting My Signature) */}
            <div
              className="bg-[var(--brand-card)] rounded-2xl shadow-md p-8 border border-[var(--brand-border-light)]
                         flex flex-col items-center text-center relative overflow-hidden
                         transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg group"
            >
              <h2 className="text-3xl font-extrabold text-[var(--brand-heading)] mb-6 pb-4 border-b-2 border-[var(--brand-border)] w-full">
                Pending My Signature
              </h2>
              <div className="my-8 flex flex-col items-center flex-grow">
                <span
                  className="text-7xl font-extrabold block mb-4 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent drop-shadow-md"
                >
                  {pendingSignatures.length}
                </span>
                <p className="text-xl text-[var(--brand-text-light)] leading-relaxed">
                  documents awaiting your signature
                </p>
              </div>
              <Link
                to="/user/signature-requests?tab=received"
                className="inline-flex justify-center items-center w-auto
                           bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-primary)]
                           text-[var(--color-text-white)] border-none py-4 px-8 rounded-full font-bold text-lg
                           transition-all duration-300 ease-out shadow-md
                           hover:from-[var(--color-primary)] hover:to-[var(--color-primary-dark)] hover:translate-y-[-4px] hover:shadow-lg"
              >
                View All Pending
              </Link>
            </div>

            {/* Section 3: Recently Signed Documents */}
            <div
              className="bg-[var(--brand-card)] rounded-2xl shadow-md p-8 border border-[var(--brand-border-light)]
                         flex flex-col items-center text-center relative overflow-hidden
                         transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg group"
            >
              <h2 className="text-3xl font-extrabold text-[var(--brand-heading)] mb-6 pb-4 border-b-2 border-[var(--brand-border)] w-full">
                Recently Signed
              </h2>
              <div className="my-8 flex flex-col items-center flex-grow">
                <span
                  className="text-7xl font-extrabold block mb-4 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent drop-shadow-md"
                >
                  {completedSignatures.length}
                </span>
                <p className="text-xl text-[var(--brand-text-light)] leading-relaxed">
                  documents you've signed
                </p>
              </div>
              <Link
                to="/user/signature-requests?tab=received"
                className="inline-flex justify-center items-center w-auto
                           bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-primary)]
                           text-[var(--color-text-white)] border-none py-4 px-8 rounded-full font-bold text-lg
                           transition-all duration-300 ease-out shadow-md
                           hover:from-[var(--color-primary)] hover:to-[var(--color-primary-dark)] hover:translate-y-[-4px] hover:shadow-lg"
              >
                View All Signed
              </Link>
            </div>

            {/* Section 4: Quick Actions / Call to Action */}
            <div
              className="bg-gradient-to-br from-[var(--color-bg-dark-start)] to-[var(--color-bg-dark-end)]
                         text-[var(--color-text-white)] rounded-2xl shadow-xl p-16
                         flex flex-col items-center text-center col-span-1 md:col-span-2 lg:col-span-3
                         transition-all duration-300 ease-out hover:scale-[1.01] hover:shadow-2xl"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 drop-shadow-lg">
                Ready to Sign?
              </h2>
              <p className="text-lg md:text-xl mb-10 max-w-2xl leading-relaxed text-[var(--color-text-white-subtle)]">
                Start a new signing process or upload a document to send for signatures.
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                <Link
                  to="/user/documents/upload"
                  className="inline-block py-4 px-10 rounded-full shadow-md font-bold text-xl
                             bg-[var(--brand-card)] text-[var(--color-button-primary)]
                             transition-all duration-300 ease-out hover:bg-gray-100 hover:translate-y-[-4px] hover:shadow-lg"
                >
                  Upload New Document
                </Link>
                <Link
                  to="/user/signature-requests"
                  className="inline-block py-4 px-10 rounded-full shadow-md font-bold text-xl
                             bg-transparent text-[var(--color-text-white)] border-2 border-[var(--color-text-white-subtle)]
                             transition-all duration-300 ease-out hover:bg-[rgba(255,255,255,0.1)] hover:translate-y-[-4px] hover:border-white"
                >
                  Request Signature
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboardPage;