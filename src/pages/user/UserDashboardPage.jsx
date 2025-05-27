import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Notification from "../components/Notification";
import { supabase } from "../../utils/supabaseClient";

const UserDashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [ownedDocuments, setOwnedDocuments] = useState([]);
  const [pendingSignatures, setPendingSignatures] = useState([]);
  const [completedSignatures, setCompletedSignatures] = useState([]);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // State to manage hover effects for cards (since inline styles don't support :hover)
  const [hoveredCard, setHoveredCard] = useState(null); // Stores the ID of the hovered card
  const [hoveredLink, setHoveredLink] = useState(null); // Stores the ID of the hovered link
  const [hoveredActionButton, setHoveredActionButton] = useState(null); // Stores the ID of the hovered action button

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
  }, [navigate]);

  const renderDocumentItem = (doc, type) => {
    const title = doc.title || doc.document?.title || "Untitled Document";
    let date = "";
    let linkPath = "";
    let statusText = "";
    const itemId = `${type}-${doc.id}`; // Unique ID for this list item's link

    if (type === "owned") {
      date = new Date(doc.updated_at).toLocaleDateString();
      linkPath = `/user/documents/${doc.id}`;
      statusText = `(${doc.status})`;
    } else if (type === "pending") {
      date = new Date(doc.requested_at).toLocaleDateString();
      linkPath = `/user/sign-document/${doc.id}`;
      statusText = `(Requested: ${date})`;
    } else if (type === "completed") {
      date = new Date(doc.signed_at).toLocaleDateString();
      linkPath = `/user/documents/${doc.document?.id}`;
      statusText = `(Signed: ${date})`;
    }

    return (
      <li key={doc.id} style={dashboardStyles.listItem}>
        <Link
          to={linkPath}
          style={{
            ...dashboardStyles.listItemLink,
            ...(hoveredLink === itemId && dashboardStyles.listItemLinkHover),
          }}
          onMouseEnter={() => setHoveredLink(itemId)}
          onMouseLeave={() => setHoveredLink(null)}
        >
          <span style={dashboardStyles.listItemTitle}>{title}</span>{" "}
          <span style={dashboardStyles.listItemStatus}>{statusText}</span>
        </Link>
      </li>
    );
  };

  return (
    <div style={dashboardStyles.pageContainer}>
      {notification.message && (
        <Notification message={notification.message} type={notification.type} />
      )}

      <h1 style={dashboardStyles.heading}>
        Welcome, {user?.user_metadata?.full_name || user?.email || "User"}!
      </h1>
      <p style={dashboardStyles.subheading}>
        Your central hub for document management and signatures.
      </p>

      {loading ? (
        <div style={dashboardStyles.loadingContainer}>Loading dashboard data...</div>
      ) : (
        <div style={dashboardStyles.gridContainer}>
          {/* Section 1: My Uploaded Documents */}
          <div
            style={{
              ...dashboardStyles.card,
              ...(hoveredCard === "ownedDocs" && dashboardStyles.cardHover),
            }}
            onMouseEnter={() => setHoveredCard("ownedDocs")}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <h2 style={dashboardStyles.cardTitle}>My Documents</h2>
            {ownedDocuments.length === 0 ? (
              <p style={dashboardStyles.noDataText}>
                You haven't uploaded any documents yet.{" "}
                <Link
                  to="/user/documents/upload"
                  style={{
                    ...dashboardStyles.actionLink,
                    ...(hoveredActionButton === "uploadDoc" && dashboardStyles.actionLinkHover),
                  }}
                  onMouseEnter={() => setHoveredActionButton("uploadDoc")}
                  onMouseLeave={() => setHoveredActionButton(null)}
                >
                  Upload one now!
                </Link>
              </p>
            ) : (
              <ul style={dashboardStyles.list}>
                {ownedDocuments.slice(0, 5).map((doc) => renderDocumentItem(doc, "owned"))}
                {ownedDocuments.length > 5 && (
                  <li style={dashboardStyles.viewAllItem}>
                    <Link
                      to="/user/documents"
                      style={{
                        ...dashboardStyles.actionLink,
                        ...(hoveredActionButton === "viewAllDocs" &&
                          dashboardStyles.actionLinkHover),
                      }}
                      onMouseEnter={() => setHoveredActionButton("viewAllDocs")}
                      onMouseLeave={() => setHoveredActionButton(null)}
                    >
                      View all your documents
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Section 2: Pending Signatures (Awaiting My Signature) */}
          <div
            style={{
              ...dashboardStyles.card,
              ...(hoveredCard === "pendingSignatures" && dashboardStyles.cardHover),
            }}
            onMouseEnter={() => setHoveredCard("pendingSignatures")}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <h2 style={dashboardStyles.cardTitle}>Pending My Signature</h2>
            {pendingSignatures.length === 0 ? (
              <p style={dashboardStyles.noDataText}>
                No documents are currently awaiting your signature.
              </p>
            ) : (
              <ul style={dashboardStyles.list}>
                {pendingSignatures.slice(0, 5).map((req) => renderDocumentItem(req, "pending"))}
                {pendingSignatures.length > 5 && (
                  <li style={dashboardStyles.viewAllItem}>
                    <Link
                      to="/user/signature-requests"
                      style={{
                        ...dashboardStyles.actionLink,
                        ...(hoveredActionButton === "viewAllPending" &&
                          dashboardStyles.actionLinkHover),
                      }}
                      onMouseEnter={() => setHoveredActionButton("viewAllPending")}
                      onMouseLeave={() => setHoveredActionButton(null)}
                    >
                      View all pending signatures
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Section 3: Recently Signed Documents */}
          <div
            style={{
              ...dashboardStyles.card,
              ...(hoveredCard === "completedSignatures" && dashboardStyles.cardHover),
            }}
            onMouseEnter={() => setHoveredCard("completedSignatures")}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <h2 style={dashboardStyles.cardTitle}>Recently Signed</h2>
            {completedSignatures.length === 0 ? (
              <p style={dashboardStyles.noDataText}>You haven't signed any documents yet.</p>
            ) : (
              <ul style={dashboardStyles.list}>
                {completedSignatures.slice(0, 5).map((req) => renderDocumentItem(req, "completed"))}
                {completedSignatures.length > 5 && (
                  <li style={dashboardStyles.viewAllItem}>
                    <Link
                      to="/user/signature-requests"
                      style={{
                        ...dashboardStyles.actionLink,
                        ...(hoveredActionButton === "viewAllSigned" &&
                          dashboardStyles.actionLinkHover),
                      }}
                      onMouseEnter={() => setHoveredActionButton("viewAllSigned")}
                      onMouseLeave={() => setHoveredActionButton(null)}
                    >
                      View all signed documents
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Section 4: Quick Actions / Call to Action - REVAMPED */}
          <div
            style={{
              ...dashboardStyles.callToActionCard,
              ...(hoveredCard === "callToAction" && dashboardStyles.callToActionCardHover),
            }}
            onMouseEnter={() => setHoveredCard("callToAction")}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <h2 style={dashboardStyles.callToActionCardTitle}>Ready to Sign?</h2>
            <p style={dashboardStyles.callToActionText}>
              Start a new signing process or upload a document to send for signatures.
            </p>
            <div style={dashboardStyles.callToActionButtons}>
              <Link
                to="/user/documents/upload"
                style={{
                  ...dashboardStyles.primaryButton,
                  marginRight: "15px",
                  ...(hoveredActionButton === "uploadNew" && dashboardStyles.primaryButtonHover),
                }}
                onMouseEnter={() => setHoveredActionButton("uploadNew")}
                onMouseLeave={() => setHoveredActionButton(null)}
              >
                Upload New Document
              </Link>
              <Link
                to="/user/signature-requests/new"
                style={{
                  ...dashboardStyles.secondaryButton,
                  ...(hoveredActionButton === "requestSignature" &&
                    dashboardStyles.secondaryButtonHover),
                }}
                onMouseEnter={() => setHoveredActionButton("requestSignature")}
                onMouseLeave={() => setHoveredActionButton(null)}
              >
                Request Signature
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Centralized styles object for the dashboard
const dashboardStyles = {
  pageContainer: {
    backgroundColor: "var(--brand-bg-light)",
    minHeight: "calc(100vh - var(--navbar-height, 0px))",
    padding: "40px",
    fontFamily: "'Inter', sans-serif",
    color: "var(--brand-text)",
  },
  heading: {
    fontSize: "3.2em",
    fontWeight: "800",
    color: "var(--brand-heading)",
    marginBottom: "10px",
    textShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  subheading: {
    fontSize: "1.3em",
    color: "var(--brand-text-light)",
    marginBottom: "40px",
  },
  loadingContainer: {
    textAlign: "center",
    padding: "60px",
    fontSize: "1.2em",
    color: "var(--brand-text-light)",
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "30px",
  },
  card: {
    backgroundColor: "var(--brand-card)",
    borderRadius: "12px",
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
    padding: "30px",
    border: "1px solid var(--brand-border)",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  // Hover style for cards
  cardHover: {
    transform: "translateY(-5px)",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.12)",
  },
  cardTitle: {
    fontSize: "2em",
    fontWeight: "700",
    color: "var(--brand-heading)",
    marginBottom: "20px",
    paddingBottom: "10px",
    borderBottom: "1px solid var(--brand-border)",
  },
  list: {
    listStyleType: "none",
    padding: 0,
    margin: 0,
  },
  listItem: {
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "1px solid var(--brand-border-light)",
    "&:last-child": {
      borderBottom: "none",
    },
  },
  listItemLink: {
    color: "var(--brand-text)",
    textDecoration: "none",
    display: "block",
    transition: "color 0.2s ease-in-out",
  },
  // Hover style for list item links
  listItemLinkHover: {
    color: "var(--color-button-primary)",
  },
  listItemTitle: {
    fontWeight: "600",
    fontSize: "1.1em",
  },
  listItemStatus: {
    fontSize: "0.9em",
    color: "var(--brand-text-light)",
    marginLeft: "8px",
  },
  noDataText: {
    color: "var(--brand-text-light)",
    fontStyle: "italic",
    padding: "10px 0",
  },
  actionLink: {
    color: "var(--color-button-primary)",
    textDecoration: "none",
    fontWeight: "600",
    transition: "text-decoration 0.2s ease-in-out",
  },
  // Hover style for action links
  actionLinkHover: {
    textDecoration: "underline",
  },
  viewAllItem: {
    marginTop: "20px",
    textAlign: "right",
  },
  callToActionCard: {
    backgroundColor: "var(--brand-bg-dark)",
    color: "white",
    borderRadius: "12px",
    boxShadow: "0 8px 25px rgba(0, 0, 0, 0.2)",
    padding: "30px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    textAlign: "center",
    gridColumn: "1 / -1",
    background: `linear-gradient(to bottom right, var(--brand-bg-dark), #333333)`,
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  // Hover style for Call to Action Card
  callToActionCardHover: {
    transform: "translateY(-5px)",
    boxShadow: "0 12px 35px rgba(0, 0, 0, 0.3)",
  },
  callToActionCardTitle: {
    fontSize: "2.4em",
    fontWeight: "800",
    color: "white",
    marginBottom: "15px",
    textShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  callToActionText: {
    fontSize: "1.1em",
    marginBottom: "25px",
    maxWidth: "500px",
    lineHeight: "1.6",
    color: "rgba(255, 255, 255, 0.9)",
  },
  callToActionButtons: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "15px",
  },
  primaryButton: {
    backgroundColor: "white",
    color: "var(--color-button-primary)",
    border: "none",
    padding: "12px 28px",
    borderRadius: "9999px",
    fontWeight: "700",
    textDecoration: "none",
    transition: "background-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    cursor: "pointer",
    fontSize: "1em",
  },
  // Hover style for primary button
  primaryButtonHover: {
    backgroundColor: "#f0f0f0",
    transform: "translateY(-2px)",
    boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    color: "white",
    border: "2px solid white",
    padding: "12px 28px",
    borderRadius: "9999px",
    fontWeight: "700",
    textDecoration: "none",
    transition: "background-color 0.3s ease, transform 0.3s ease, border-color 0.3s ease",
    cursor: "pointer",
    fontSize: "1em",
  },
  // Hover style for secondary button
  secondaryButtonHover: {
    backgroundColor: "rgba(255,255,255,0.1)",
    transform: "translateY(-2px)",
  },
};

export default UserDashboardPage;
