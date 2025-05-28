// src/components/DocumentViewer.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";

const DocumentViewer = ({ filePath, fileType }) => {
  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!filePath) {
        setError("No file path provided for viewer.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Create a signed URL for viewing the file.
        // The default expiry is 60 seconds (60), but you can adjust.
        const { data, error } = await supabase.storage
          .from("documents") // Your storage bucket name
          .createSignedUrl(filePath, 60);

        if (error) {
          throw error;
        }

        setFileUrl(data.signedUrl);
      } catch (err) {
        console.error("Error fetching signed URL:", err);
        setError(`Failed to load document preview: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [filePath]);

  if (loading) {
    return <div style={viewerStyles.container}>Loading preview...</div>;
  }

  if (error) {
    return <div style={viewerStyles.error}>{error}</div>;
  }

  if (!fileUrl) {
    return <div style={viewerStyles.container}>No preview available.</div>;
  }

  const isPDF = fileType === "application/pdf";
  const isImage = fileType.startsWith("image/");

  if (isPDF) {
    return (
      <div style={viewerStyles.container}>
        {fileUrl ? (
          <embed
            src={fileUrl + "#toolbar=1&navpanes=0&scrollbar=1"}
            type="application/pdf"
            width="100%"
            height="100%"
          />
        ) : (
          <p>No preview available</p>
        )}
      </div>
    );
  }
  if (isImage) {
    return (
      <div style={viewerStyles.container}>
        <img src={fileUrl} alt="Document Preview" style={viewerStyles.image} loading="lazy" />
      </div>
    );
  }

  return (
    <div style={viewerStyles.container}>
      <p>No preview available for this file type ({fileType}).</p>
      <p>Please download the file to view its content.</p>
    </div>
  );
};

const viewerStyles = {
  container: {
    width: "100%",
    height: "600px", // Fixed height for viewer
    backgroundColor: "var(--brand-bg-dark)",
    borderRadius: "8px",
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    color: "var(--brand-text-light)",
    fontSize: "1.1em",
    border: "1px solid var(--brand-border)",
  },
  iframe: {
    width: "100%",
    height: "100%",
  },
  image: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain", // Ensures image fits within bounds
  },
  error: {
    color: "var(--color-error-text)",
    backgroundColor: "var(--color-error-bg)",
    padding: "15px",
    borderRadius: "8px",
    textAlign: "center",
  },
};

export default DocumentViewer;
