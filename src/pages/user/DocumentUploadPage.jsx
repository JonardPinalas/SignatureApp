// src/pages/user/DocumentUploadPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import { useNavigate } from "react-router-dom";


async function calculateFileHash(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target.result; // ArrayBuffer
        // Use Web Crypto API for SHA-256 hashing
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        // Convert ArrayBuffer to Array of bytes
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        // Convert bytes to hex string
        const hexHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        resolve(hexHash);
      } catch (error) {
        console.error("Error during hash calculation:", error);
        reject(new Error("Failed to calculate file hash."));
      }
    };
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      reject(new Error("Error reading file for hashing."));
    };
    reader.readAsArrayBuffer(file);
  });
}

const DocumentUploadPage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); // New state for document description
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        setNotification({
          message: "You need to be logged in to upload documents.",
          type: "error",
        });
        navigate("/login");
      } else {
        setUser(user);
      }
    };
    fetchUser();
  }, [navigate]);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!user) {
      setNotification({ message: "No user logged in.", type: "error" });
      return;
    }

    if (!selectedFile) {
      setNotification({ message: "Please select a file first.", type: "error" });
      return;
    }

    if (!title.trim()) {
      setNotification({ message: "Please enter a document title.", type: "error" });
      return;
    }

    setUploading(true);
    setNotification({ message: "Calculating file hash and preparing upload...", type: "info" });

    let fileHash = null;
    try {
      // Calculate the hash of the selected file
      fileHash = await calculateFileHash(selectedFile);
    } catch (hashError) {
      console.error("Error calculating file hash:", hashError);
      setNotification({ message: `Failed to calculate file hash: ${hashError.message}`, type: "error" });
      setUploading(false);
      return;
    }

    try {
      // 1. Insert into documents table
      const { data: documentData, error: documentError } = await supabase
        .from("documents")
        .insert([
          {
            owner_id: user.id,
            title: title.trim(),
            description: description.trim() || null, // Allow null if empty
            status: "draft", // Initial status
            latest_version_number: 0, // Will be updated to 1 after first version is added
            current_document_version_id: null, // Will be linked after version is added
            original_hash: fileHash, // <-- Store the calculated hash here!
          },
        ])
        .select()
        .single();

      if (documentError) {
        throw documentError;
      }

      // 2. Upload file to storage
      // Path format: <user_id>/<document_id>/version_1_<filename>
      const filePath = `${user.id}/${documentData.id}/version_1_${selectedFile.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents") // Your storage bucket name
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false, // Ensure we don't overwrite if path accidentally exists
        });

      if (uploadError) {
        // If file upload fails, consider deleting the document record to prevent orphaned data
        await supabase.from("documents").delete().eq("id", documentData.id);
        throw uploadError;
      }

      // 3. Insert into document_versions table (first version)
      const { data: versionData, error: versionError } = await supabase
        .from("document_versions")
        .insert([
          {
            document_id: documentData.id,
            version_number: 1, // This is the first version
            file_path: uploadData.path,
            file_name: selectedFile.name, // Matched with schema
            file_type: selectedFile.type || "application/octet-stream", // Matched with schema, fallback
            file_size: selectedFile.size, // Matched with schema
            created_by_user_id: user.id,
            description_of_changes: "Initial upload of document.",
            is_signed_version: false,
          },
        ])
        .select()
        .single();

      if (versionError) {
        // If version insertion fails, try to delete the uploaded file and the document record
        await supabase.storage.from("documents").remove([uploadData.path]);
        await supabase.from("documents").delete().eq("id", documentData.id);
        throw versionError;
      }

      // 4. Update the documents table with the latest version info
      const { error: updateDocError } = await supabase
        .from("documents")
        .update({
          latest_version_number: 1,
          current_document_version_id: versionData.id,
          updated_at: new Date().toISOString(), // Update timestamp
        })
        .eq("id", documentData.id);

      if (updateDocError) {
        // This is a critical error. The document record is out of sync.
        console.error("Critical error: Failed to link document to its first version.", updateDocError);
        setNotification({
          message: "Document uploaded, but failed to link to its version. Please contact support.",
          type: "error",
        });
        // Still proceed with a success message for the user for the upload, as the files exist.
      } else {
        setNotification({ message: "Document uploaded successfully!", type: "success" });
        // Clear form fields
        setSelectedFile(null);
        setTitle("");
        setDescription("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }

      // Optionally redirect to the new document's detail page or My Documents
      navigate(`/user/documents/${documentData.id}`);
    } catch (error) {
      console.error("Upload failed:", error);
      setNotification({ message: `Upload failed: ${error.message}`, type: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      <h1 style={styles.heading}>Upload New Document</h1>
      <p style={styles.subheading}>Start by uploading your first document to the system.</p>

      <form onSubmit={handleUpload} style={styles.uploadForm}>
        <div style={styles.formGroup}>
          <label htmlFor="documentTitle" style={styles.label}>
            Document Title:
          </label>
          <input type="text" id="documentTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Q2 Financial Report" required style={styles.input} />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="documentDescription" style={styles.label}>
            Description (Optional):
          </label>
          <textarea
            id="documentDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
            placeholder="A brief description of the document's content."
            style={styles.textarea}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="fileUpload" style={styles.label}>
            Select File:
          </label>
          <input type="file" id="fileUpload" ref={fileInputRef} onChange={handleFileChange} required style={styles.fileInput} />
          {selectedFile && (
            <p style={styles.fileName}>
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <button type="submit" disabled={uploading || !user} style={styles.uploadButton}>
          {uploading ? "Uploading..." : "Upload Document"}
        </button>
      </form>
    </div>
  );
};

const styles = {
  pageContainer: {
    backgroundColor: "var(--brand-bg-light)",
    minHeight: "calc(100vh - var(--navbar-height, 0px))",
    padding: "40px",
    fontFamily: "'Inter', sans-serif",
    color: "var(--brand-text)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  heading: {
    fontSize: "3.2em",
    fontWeight: "800",
    color: "var(--brand-heading)",
    marginBottom: "10px",
    textShadow: "0 2px 4px rgba(0,0,0,0.05)",
    textAlign: "center",
  },
  subheading: {
    fontSize: "1.3em",
    color: "var(--brand-text-light)",
    marginBottom: "40px",
    textAlign: "center",
    maxWidth: "800px",
  },
  uploadForm: {
    backgroundColor: "var(--brand-card)",
    borderRadius: "12px",
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
    padding: "40px",
    border: "1px solid var(--brand-border)",
    width: "100%",
    maxWidth: "600px",
    display: "flex",
    flexDirection: "column",
    gap: "25px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "1.1em",
    fontWeight: "600",
    color: "var(--brand-text)",
  },
  input: {
    padding: "12px 15px",
    border: "1px solid var(--brand-border-light)",
    borderRadius: "8px",
    fontSize: "1em",
    color: "var(--brand-text)",
    backgroundColor: "var(--brand-bg-dark-accent)",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    "&:focus": {
      borderColor: "var(--color-primary)",
      boxShadow: "0 0 0 3px rgba(var(--color-primary-rgb), 0.2)",
      outline: "none",
    },
  },
  textarea: {
    padding: "12px 15px",
    border: "1px solid var(--brand-border-light)",
    borderRadius: "8px",
    fontSize: "1em",
    color: "var(--brand-text)",
    backgroundColor: "var(--brand-bg-dark-accent)",
    minHeight: "100px",
    resize: "vertical",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    "&:focus": {
      borderColor: "var(--color-primary)",
      boxShadow: "0 0 0 3px rgba(var(--color-primary-rgb), 0.2)",
      outline: "none",
    },
  },
  fileInput: {
    padding: "10px",
    border: "1px solid var(--brand-border-light)",
    borderRadius: "8px",
    backgroundColor: "var(--brand-bg-dark-accent)",
    color: "var(--brand-text)",
    cursor: "pointer",
  },
  fileName: {
    fontSize: "0.9em",
    color: "var(--brand-text-light)",
    marginTop: "5px",
  },
  uploadButton: {
    backgroundColor: "var(--color-button-primary)",
    color: "white",
    border: "none",
    padding: "15px 30px",
    borderRadius: "9999px",
    fontWeight: "700",
    fontSize: "1.1em",
    cursor: "pointer",
    transition: "background-color 0.3s ease, transform 0.2s ease",
    boxShadow: "0 5px 15px rgba(0,0,0,0.15)",
    marginTop: "20px",
    alignSelf: "center",
    width: "fit-content",
    "&:hover": {
      backgroundColor: "var(--color-button-primary-hover)",
      transform: "translateY(-2px)",
    },
    "&:disabled": {
      backgroundColor: "var(--color-grey)",
      cursor: "not-allowed",
      transform: "none",
      boxShadow: "none",
    },
  },
};

export default DocumentUploadPage;
