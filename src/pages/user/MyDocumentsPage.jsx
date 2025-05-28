// src/pages/user/MyDocumentsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";

const MyDocumentsPage = () => {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const navigate = useNavigate();

  // State for hover effects (consistent with dashboard)
  const [hoveredLink, setHoveredLink] = useState(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      setNotification({ message: "Fetching your documents...", type: "info" });

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setNotification({ message: "Please log in to view your documents.", type: "error" });
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .select(
          `
        id,
        title,
        status,
        created_at,
        updated_at,
        document_versions:fk_document_versions_document_id (
          id,
          version_number,
          file_path,
          created_at
        )
      `
        )

        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching documents:", error);
        setNotification({ message: "Error loading your documents.", type: "error" });
      } else {
        setDocuments(data);
        setNotification({ message: "Documents loaded successfully!", type: "success" });
        setTimeout(() => setNotification({ message: "", type: "" }), 3000); // Clear success message
      }
      setLoading(false);
    };

    fetchDocuments();
  }, [navigate]);

  const getLatestVersion = (doc) => {
    if (!doc.document_versions || doc.document_versions.length === 0) return null;
    return doc.document_versions.reduce((latest, current) => {
      return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
    });
  };

  const renderDocumentItem = (doc) => {
    const latestVersion = getLatestVersion(doc);
    const itemId = `doc-${doc.id}`; // Unique ID for this document's link

    return (
      <li key={doc.id} style={styles.documentItem}>
        <Link
          to={`/user/documents/${doc.id}`} // Link to a detail page for each document
          style={{
            ...styles.documentLink,
            ...(hoveredLink === itemId && styles.documentLinkHover),
          }}
          onMouseEnter={() => setHoveredLink(itemId)}
          onMouseLeave={() => setHoveredLink(null)}
        >
          <div style={styles.documentTitleContainer}>
            <span style={styles.documentTitle}>{doc.title || "Untitled Document"}</span>
            <span style={styles.documentStatus}>({doc.status})</span>
          </div>
          <div style={styles.documentMeta}>
            <span>Created: {new Date(doc.created_at).toLocaleDateString()}</span>
            <span>Last Updated: {new Date(doc.updated_at).toLocaleDateString()}</span>
            {latestVersion && <span>Version: {latestVersion.version_number}</span>}
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div style={styles.pageContainer}>
      {notification.message && (
        <Notification message={notification.message} type={notification.type} />
      )}

      <h1 style={styles.heading}>My Documents</h1>
      <p style={styles.subheading}>Manage all the documents you've uploaded.</p>

      {loading ? (
        <div style={styles.loadingContainer}>Loading your documents...</div>
      ) : (
        <div style={styles.contentArea}>
          <div style={styles.topActions}>
            <Link to="/user/documents/upload" style={styles.uploadButton}>
              Upload New Document
            </Link>
          </div>

          {documents.length === 0 ? (
            <p style={styles.noDocuments}>
              You haven't uploaded any documents yet.
              <Link to="/user/documents/upload" style={styles.actionLink}>
                {" "}
                Click here to upload your first document!
              </Link>
            </p>
          ) : (
            <ul style={styles.documentList}>{documents.map(renderDocumentItem)}</ul>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  pageContainer: {
    backgroundColor: "var(--brand-bg-light)",
    minHeight: "calc(100vh - var(--navbar-height, 0px))", // Adjust for navbar height
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
  contentArea: {
    backgroundColor: "var(--brand-card)",
    borderRadius: "12px",
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
    padding: "30px",
    border: "1px solid var(--brand-border)",
  },
  topActions: {
    marginBottom: "30px",
    textAlign: "right", // Align upload button to the right
  },
  uploadButton: {
    backgroundColor: "var(--color-button-primary)",
    color: "white",
    border: "none",
    padding: "12px 28px",
    borderRadius: "9999px",
    fontWeight: "600",
    textDecoration: "none",
    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
    cursor: "pointer",
    transition: "background-color 0.3s ease, transform 0.2s ease",
    fontSize: "1em",
    display: "inline-block", // Allows marginRight if needed later
    "&:hover": {
      // This will require onMouseEnter/Leave as explained below
      backgroundColor: "var(--color-button-primary-hover)",
      transform: "translateY(-2px)",
    },
  },
  noDocuments: {
    color: "var(--brand-text-light)",
    fontStyle: "italic",
    textAlign: "center",
    padding: "30px 0",
    fontSize: "1.1em",
  },
  actionLink: {
    color: "var(--color-button-primary)",
    textDecoration: "none",
    fontWeight: "600",
    transition: "text-decoration 0.2s ease-in-out",
    "&:hover": {
      // This will require onMouseEnter/Leave as explained below
      textDecoration: "underline",
    },
  },
  documentList: {
    listStyleType: "none",
    padding: 0,
    margin: 0,
  },
  documentItem: {
    marginBottom: "15px",
    paddingBottom: "15px",
    borderBottom: "1px solid var(--brand-border-light)",
    "&:last-child": {
      borderBottom: "none",
    },
  },
  documentLink: {
    textDecoration: "none",
    display: "block",
    color: "var(--brand-text)", // Default text color
    transition: "color 0.2s ease-in-out",
  },
  documentLinkHover: {
    color: "var(--color-button-primary)", // Primary color on hover
  },
  documentTitleContainer: {
    display: "flex",
    alignItems: "center",
    marginBottom: "5px",
  },
  documentTitle: {
    fontSize: "1.3em",
    fontWeight: "600",
    marginRight: "10px",
  },
  documentStatus: {
    fontSize: "0.9em",
    backgroundColor: "var(--brand-bg-light)", // Light background for status badge
    color: "var(--brand-text-light)",
    padding: "4px 10px",
    borderRadius: "20px",
    fontWeight: "500",
  },
  documentMeta: {
    fontSize: "0.9em",
    color: "var(--brand-text-light)",
    display: "flex",
    gap: "20px", // Space out meta info
    flexWrap: "wrap", // Allow wrapping on small screens
  },
};

export default MyDocumentsPage;
