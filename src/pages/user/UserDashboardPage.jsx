// src/pages/user/UserDashboardPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Notification from "../../components/Notification"; // Adjust path based on your structure
import { supabase } from "../../utils/supabaseClient"; // Adjust path based on your structure

const UserDashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [ownedDocuments, setOwnedDocuments] = useState([]);
  const [pendingSignatures, setPendingSignatures] = useState([]);
  const [completedSignatures, setCompletedSignatures] = useState([]);
  const [notification, setNotification] = useState({ message: "", type: "" });

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

      // Fetch user's profile from public.users table to get full_name and role
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
        // If an admin somehow lands here, redirect them to their admin dashboard
        if (userProfile.role === "admin") {
          setNotification({ message: "Redirecting to Admin Dashboard...", type: "info" });
          navigate("/admin/dashboard");
          return; // Stop further execution for non-admin dashboard
        }
      }

      // --- Data Fetching for User Dashboard Sections ---

      // 1. Documents owned by the user
      const { data: ownedDocs, error: ownedDocsError } = await supabase
        .from("documents")
        .select("id, title, status, updated_at")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });

      if (ownedDocsError) {
        console.error("Error fetching owned documents:", ownedDocsError);
        setNotification({ message: "Error loading your documents.", type: "error" });
      }
      setOwnedDocuments(ownedDocs || []);

      // 2. Signature requests awaiting the user's signature
      const { data: pendingReqs, error: pendingReqsError } = await supabase
        .from("signature_requests")
        .select(
          `
          id,
          status,
          requested_at,
          document_version_id,
          document:document_id (id, title, owner_id)
        `
        )
        .eq("signer_id", user.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (pendingReqsError) {
        console.error("Error fetching pending signatures:", pendingReqsError);
        setNotification({ message: "Error loading pending signatures.", type: "error" });
      }
      setPendingSignatures(pendingReqs || []);

      // 3. Signature requests completed by the user
      const { data: completedReqs, error: completedReqsError } = await supabase
        .from("signature_requests")
        .select(
          `
          id,
          status,
          signed_at,
          document_version_id,
          document:document_id (id, title, owner_id)
        `
        )
        .eq("signer_id", user.id)
        .eq("status", "signed")
        .order("signed_at", { ascending: false });

      if (completedReqsError) {
        console.error("Error fetching completed signatures:", completedReqsError);
        setNotification({ message: "Error loading completed signatures.", type: "error" });
      }
      setCompletedSignatures(completedReqs || []);

      setLoading(false);
      setNotification({ message: "Dashboard loaded!", type: "success" });
      setTimeout(() => setNotification({ message: "", type: "" }), 3000);
    };

    fetchDashboardData();
  }, [navigate]);

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {notification.message && (
        <Notification message={notification.message} type={notification.type} />
      )}

      <h1 style={{ fontSize: "2.5em", marginBottom: "20px", color: "#333" }}>
        Hello, {user?.user_metadata?.full_name || user?.email || "User"}!
      </h1>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px", color: "#555" }}>
          Loading dashboard data...
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Section 1: My Uploaded Documents */}
          <div
            style={{
              background: "#fff",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: "1.8em", marginBottom: "15px", color: "#555" }}>My Documents</h2>
            {ownedDocuments.length === 0 ? (
              <p style={{ color: "#666" }}>
                You haven't uploaded any documents yet.{" "}
                <a
                  href="/user/documents/upload"
                  style={{ textDecoration: "underline", color: "#007bff" }}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/user/documents/upload");
                  }}
                >
                  Upload one now!
                </a>
              </p>
            ) : (
              <ul style={{ listStyleType: "none", padding: 0 }}>
                {ownedDocuments.slice(0, 5).map((doc) => (
                  <li
                    key={doc.id}
                    style={{
                      marginBottom: "10px",
                      borderBottom: "1px solid #eee",
                      paddingBottom: "5px",
                    }}
                  >
                    <a
                      href={`/user/documents/${doc.id}`}
                      style={{ color: "#007bff", textDecoration: "none" }}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/user/documents/${doc.id}`);
                      }}
                    >
                      <span style={{ fontWeight: "bold" }}>{doc.title}</span> ({doc.status})
                    </a>
                    <br />
                    <small style={{ color: "#888" }}>
                      Last Updated: {new Date(doc.updated_at).toLocaleDateString()}
                    </small>
                  </li>
                ))}
                {ownedDocuments.length > 5 && (
                  <li style={{ marginTop: "10px" }}>
                    <a
                      href="/user/documents"
                      style={{ textDecoration: "underline", color: "#007bff" }}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/user/documents");
                      }}
                    >
                      View all your documents
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Section 2: Pending Signatures (Awaiting My Signature) */}
          <div
            style={{
              background: "#fff",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: "1.8em", marginBottom: "15px", color: "#555" }}>
              Pending My Signature
            </h2>
            {pendingSignatures.length === 0 ? (
              <p style={{ color: "#666" }}>No documents are currently awaiting your signature.</p>
            ) : (
              <ul style={{ listStyleType: "none", padding: 0 }}>
                {pendingSignatures.slice(0, 5).map((req) => (
                  <li
                    key={req.id}
                    style={{
                      marginBottom: "10px",
                      borderBottom: "1px solid #eee",
                      paddingBottom: "5px",
                    }}
                  >
                    <a
                      href={`/user/sign-document/${req.id}`}
                      style={{ color: "#007bff", textDecoration: "none" }}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/user/sign-document/${req.id}`);
                      }}
                    >
                      <span style={{ fontWeight: "bold" }}>{req.document?.title}</span> (Requested:{" "}
                      {new Date(req.requested_at).toLocaleDateString()})
                    </a>
                  </li>
                ))}
                {pendingSignatures.length > 5 && (
                  <li style={{ marginTop: "10px" }}>
                    <a
                      href="/user/pending-signatures"
                      style={{ textDecoration: "underline", color: "#007bff" }}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/user/pending-signatures");
                      }}
                    >
                      View all pending signatures
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Section 3: Recently Signed Documents */}
          <div
            style={{
              background: "#fff",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: "1.8em", marginBottom: "15px", color: "#555" }}>
              Recently Signed
            </h2>
            {completedSignatures.length === 0 ? (
              <p style={{ color: "#666" }}>You haven't signed any documents yet.</p>
            ) : (
              <ul style={{ listStyleType: "none", padding: 0 }}>
                {completedSignatures.slice(0, 5).map((req) => (
                  <li
                    key={req.id}
                    style={{
                      marginBottom: "10px",
                      borderBottom: "1px solid #eee",
                      paddingBottom: "5px",
                    }}
                  >
                    <span style={{ fontWeight: "bold" }}>{req.document?.title}</span> (Signed:{" "}
                    {new Date(req.signed_at).toLocaleDateString()})
                  </li>
                ))}
                {completedSignatures.length > 5 && (
                  <li style={{ marginTop: "10px" }}>
                    <a
                      href="/user/signed-documents"
                      style={{ textDecoration: "underline", color: "#007bff" }}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/user/signed-documents");
                      }}
                    >
                      View all signed documents
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboardPage;
