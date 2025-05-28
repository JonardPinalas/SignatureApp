import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import DocumentViewer from "../components/DocumentViewer";
import Modal from "../components/Modal"; // Assuming you have a Modal component

// Helper function to validate and parse multiple emails
const parseAndValidateEmails = (input) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Split by comma, semicolon, or newline, then trim whitespace
  const emails = input
    .split(/[,;\n]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  const validEmails = [];
  const invalidEmails = [];
  const seenEmails = new Set(); // To store unique emails

  emails.forEach((email) => {
    if (emailRegex.test(email)) {
      if (!seenEmails.has(email)) {
        validEmails.push(email);
        seenEmails.add(email);
      }
    } else {
      invalidEmails.push(email);
    }
  });

  return { validEmails, invalidEmails };
};

const DocumentDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [signatureRequests, setSignatureRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [user, setUser] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [newVersionDescription, setNewVersionDescription] = useState("");
  const fileInputRef = useRef(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // --- MODIFIED STATE FOR MULTIPLE RECIPIENTS ---
  const [showSignRequestModal, setShowSignRequestModal] = useState(false);
  const [signerEmailsInput, setSignerEmailsInput] = useState(""); // Holds the raw input string

  const [activeTab, setActiveTab] = useState("requests");
  // New state for selected version in signature requests pane
  const [selectedVersionForSignatures, setSelectedVersionForSignatures] = useState("");

  // State for Report an Issue Modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [issueContactEmail, setIssueContactEmail] = useState("");

  // --- Data Fetching ---
  const fetchAllDocumentData = async () => {
    setLoading(true);
    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !currentUser) {
      setNotification({
        message: "You need to be logged in to view document details.",
        type: "error",
      });
      navigate("/login");
      setLoading(false);
      return;
    }
    setUser(currentUser);
    setIssueContactEmail(currentUser.email || ""); // Pre-fill contact email

    // Fetch document details
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .select(
        `
          *,
          current_document_version:current_document_version_id (
            id, file_path, file_name, file_type, file_size, version_number
          )
        `
      )
      .eq("id", id)
      .eq("owner_id", currentUser.id) // Ensure only owner can view
      .single();

    if (docError) {
      console.error("Error fetching document:", docError);
      setNotification({
        message: `Error loading document: ${docError.message}`,
        type: "error",
      });
      setLoading(false);
      if (docError.code === "PGRST116" || docError.message.includes("Row not found")) {
        setNotification({
          message: "Document not found or you don't have access.",
          type: "error",
        });
        navigate("/user/documents");
      }
      return;
    }
    setDoc(docData);
    setEditedTitle(docData.title);
    setEditedDescription(docData.description || "");

    // Fetch document versions
    const { data: versionsData, error: versionsError } = await supabase
      .from("document_versions")
      .select(
        `
          id, version_number, file_path, file_name, file_type, file_size,
          created_at, created_by_user_id, description_of_changes, is_signed_version
        `
      )
      .eq("document_id", id)
      .order("version_number", { ascending: false });

    if (versionsError) {
      console.error("Error fetching document versions:", versionsError);
      setNotification({
        message: `Error loading document versions: ${versionsError.message}`,
        type: "error",
      });
    } else {
      setVersions(versionsData);
      // Set initial selected version for signatures to the latest one
      if (docData.current_document_version_id) {
        setSelectedVersionForSignatures(docData.current_document_version_id);
      } else if (versionsData.length > 0) {
        setSelectedVersionForSignatures(versionsData[0].id);
      }
    }

    // Fetch signature requests for the document
    const { data: signRequestsData, error: signRequestsError } = await supabase
      .from("signature_requests")
      .select(
        `
        id, document_version_id, signer_email, status, requested_at, signed_at,
        declined_at, cancelled_at, signing_url,
        signer:signer_id (full_name)
      `
      )
      .eq("document_id", id)
      .order("requested_at", { ascending: true });

    if (signRequestsError) {
      console.error("Error fetching signature requests:", signRequestsError);
      setNotification({
        message: `Error loading signature requests: ${signRequestsError.message}`,
        type: "error",
      });
    } else {
      setSignatureRequests(signRequestsData);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAllDocumentData();
  }, [id, navigate]);

  const handleDownload = async (filePath, fileName) => {
    if (typeof window === "undefined" || typeof window.document === "undefined") {
      console.error("Download attempted outside the browser environment.");
      return;
    }

    if (!filePath || !fileName) {
      setNotification({ message: "File path or name is missing.", type: "error" });
      return;
    }

    try {
      const { data, error } = await supabase.storage.from("documents").download(filePath);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotification({ message: `Downloading ${fileName}...`, type: "info" });
    } catch (error) {
      console.error("Error downloading file:", error);
      setNotification({ message: `Failed to download file: ${error.message}`, type: "error" });
    }
  };

  const handleSaveDocumentDetails = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("documents")
      .update({
        title: editedTitle,
        description: editedDescription,
      })
      .eq("id", doc.id)
      .eq("owner_id", user.id);

    if (error) {
      setNotification({
        message: `Failed to update document details: ${error.message}`,
        type: "error",
      });
      console.error("Error updating document:", error);
    } else {
      setDoc((prev) => ({ ...prev, title: editedTitle, description: editedDescription }));
      setNotification({ message: "Document details updated successfully!", type: "success" });
      setIsEditing(false);
    }
    setLoading(false);
  };

  const handleNewVersionUpload = async (e) => {
    e.preventDefault();

    if (!newVersionFile) {
      setNotification({ message: "Please select a file to upload.", type: "error" });
      return;
    }
    if (!doc) {
      setNotification({ message: "Document not loaded.", type: "error" });
      return;
    }

    setLoading(true);
    setShowUploadModal(false);

    const newVersionNumber = (doc.latest_version_number || 0) + 1;
    const sanitizedFileName = newVersionFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = `${user.id}/${doc.id}/version_${newVersionNumber}_${sanitizedFileName}`;

    try {
      console.log("--- Starting New Version Upload ---");
      console.log("Document ID:", doc.id);
      console.log(
        "Current Document Version ID (before new upload):",
        doc.current_document_version_id
      );
      console.log("New Version Number:", newVersionNumber);
      console.log("File Name:", newVersionFile.name);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, newVersionFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase Storage Upload Error:", uploadError);
        throw uploadError;
      }

      console.log("File uploaded to storage successfully:", uploadData.path);

      // --- VOID PREVIOUS SIGNATURE REQUESTS ---
      let updatedRequests = [];

      if (doc.current_document_version_id) {
        console.log("Attempting to void previous signature requests...");
        const voidedAtTimestamp = new Date().toISOString();

        const { data, error: updateRequestsError } = await supabase
          .from("signature_requests")
          .update(
            {
              status: "void",
              voided_at: voidedAtTimestamp,
            },
            { returning: "representation" }
          ) // ensures .select() works
          .eq("document_id", doc.id)
          .eq("document_version_id", doc.current_document_version_id);

        updatedRequests = data || [];

        if (updateRequestsError) {
          console.error("Error voiding previous signature requests:", updateRequestsError);
          setNotification({
            message: "New version uploaded, but failed to void some old signature requests.",
            type: "warning",
          });
        } else {
          console.log(
            "Previous signature requests update result:",
            updatedRequests.length,
            "requests updated to 'void'."
          );
          setNotification({
            message: `Previous signature requests voided.`,
            type: "info",
          });
        }
      } else {
        console.log("No previous document_version_id found. Skipping voiding of old requests.");
      }

      // --- INSERT NEW DOCUMENT VERSION ---
      const { data: versionData, error: versionError } = await supabase
        .from("document_versions")
        .insert([
          {
            document_id: doc.id,
            version_number: newVersionNumber,
            file_path: uploadData.path,
            file_name: newVersionFile.name,
            file_type: newVersionFile.type || "application/octet-stream",
            file_size: newVersionFile.size,
            created_by_user_id: user.id,
            description_of_changes: newVersionDescription,
            is_signed_version: false,
          },
        ])
        .select()
        .single();

      if (versionError) {
        console.error("Document Version Insert Error:", versionError);
        await supabase.storage.from("documents").remove([uploadData.path]);
        throw versionError;
      }

      console.log("New document version inserted:", versionData);

      // --- UPDATE DOCUMENT RECORD ---
      const { error: docUpdateError } = await supabase
        .from("documents")
        .update({
          latest_version_number: newVersionNumber,
          current_document_version_id: versionData.id,
        })
        .eq("id", doc.id);

      if (docUpdateError) {
        console.error(
          "Critical error: Failed to update document's current version:",
          docUpdateError
        );
        setNotification({
          message: `Document updated, but link to new version failed. Please contact support.`,
          type: "error",
        });
      } else {
        setNotification({
          message: `Document updated to Version ${newVersionNumber}!`,
          type: "success",
        });
        console.log("Document successfully updated to new current version.");
      }

      setNewVersionFile(null);
      setNewVersionDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchAllDocumentData();
    } catch (error) {
      console.error("Overall New Version Upload Process Failed:", error);
      setNotification({ message: `Upload failed: ${error.message}`, type: "error" });
    } finally {
      setLoading(false);
      console.log("--- New Version Upload Process Finished ---");
    }
  };

  // --- MODIFIED handleSendForSignature FUNCTION ---
  const handleSendForSignature = async (e) => {
    e.preventDefault();

    const { validEmails, invalidEmails } = parseAndValidateEmails(signerEmailsInput);

    if (validEmails.length === 0) {
      setNotification({
        message: "Please enter at least one valid email address to send the request.",
        type: "error",
      });
      return;
    }

    if (!doc || !doc.current_document_version) {
      setNotification({
        message: "No current document version to send for signature.",
        type: "error",
      });
      return;
    }

    setLoading(true);
    setShowSignRequestModal(false);

    const successfulRequests = [];
    const failedRequests = [];

    // Prepare all insert promises
    const requestPromises = validEmails.map(async (email) => {
      try {
        const signatureRequestId = crypto.randomUUID();
        // Use /user/sign/ as per your AppRoutes.jsx for authenticated signing link
        const signingUrl = `${window.location.origin}/user/sign/${signatureRequestId}`;

        // Important: Add a check for existing requests to the same email for the current document version
        // This prevents duplicate requests if a user tries to send to the same email again for the *same version*.
        const { data: existingRequests, error: existingReqError } = await supabase
          .from("signature_requests")
          .select("id")
          .eq("document_id", doc.id)
          .eq("document_version_id", doc.current_document_version_id)
          .eq("signer_email", email)
          .maybeSingle(); // Use maybeSingle to get null if not found

        if (existingReqError) {
          throw existingReqError;
        }

        if (existingRequests) {
          // If a request already exists for this signer and version, treat it as a success for this loop,
          // but inform the user it was already sent.
          successfulRequests.push({ email, status: "already_sent" });
          return;
        }

        const { data: signatureRequest, error: signRequestError } = await supabase
          .from("signature_requests")
          .insert([
            {
              id: signatureRequestId,
              document_id: doc.id,
              document_version_id: doc.current_document_version_id,
              signer_email: email,
              status: "pending",
              requested_at: new Date().toISOString(),
              signing_url: signingUrl,
            },
          ])
          .select()
          .single();

        if (signRequestError) {
          throw signRequestError;
        }

        await supabase.from("audit_logs").insert({
          user_id: user.id,
          user_email: user.email,
          event_type: "SIGNATURE_REQUEST_SENT",
          document_id: doc.id,
          document_version_id: doc.current_document_version_id,
          details: {
            signer_email: email,
            signature_request_id: signatureRequest.id,
            signing_url: signingUrl,
          },
        });

        successfulRequests.push({ email, id: signatureRequest.id, signing_url: signingUrl });
      } catch (error) {
        console.error(`Error sending signature request to ${email}:`, error);
        failedRequests.push({ email, error: error.message });
      }
    });

    // Wait for all promises to settle (resolve or reject)
    await Promise.allSettled(requestPromises);

    // Update document status if at least one request was successfully initiated
    if (
      successfulRequests.length > 0 &&
      doc.status !== "pending_signature" &&
      doc.status !== "signed"
    ) {
      const { error: docStatusUpdateError } = await supabase
        .from("documents")
        .update({ status: "pending_signature" })
        .eq("id", doc.id);

      if (docStatusUpdateError) {
        console.error(
          "Failed to update document status after signature request:",
          docStatusUpdateError
        );
        setNotification({
          message: `Some signature requests sent, but document status update failed. Please check document status manually.`,
          type: "warning",
        });
      } else {
        setDoc((prev) => ({ ...prev, status: "pending_signature" }));
      }
    }

    // Construct a comprehensive notification
    let notificationMessage = "";
    let notificationType = "success";

    if (successfulRequests.length > 0) {
      const sentCount = successfulRequests.filter((req) => req.status !== "already_sent").length;
      const alreadySentCount = successfulRequests.filter(
        (req) => req.status === "already_sent"
      ).length;
      notificationMessage += `${sentCount} signature request(s) sent successfully.`;
      if (alreadySentCount > 0) {
        notificationMessage += ` (${alreadySentCount} request(s) were already pending for the current version.)`;
      }
    }

    if (failedRequests.length > 0) {
      notificationType = successfulRequests.length > 0 ? "warning" : "error";
      const failedEmails = failedRequests.map((req) => req.email).join(", ");
      notificationMessage += ` Failed to send to: ${failedEmails}.`;
      notificationMessage += ` Details: ${failedRequests.map((f) => f.error).join("; ")}`;
    }

    if (invalidEmails.length > 0) {
      notificationType = notificationType === "success" ? "warning" : "error";
      const invalidEmailList = invalidEmails.join(", ");
      notificationMessage += ` Invalid emails ignored: ${invalidEmailList}.`;
    }

    if (notificationMessage) {
      setNotification({ message: notificationMessage, type: notificationType });
    } else {
      setNotification({ message: "No valid emails provided.", type: "error" });
    }

    setSignerEmailsInput(""); // Clear the input field
    await fetchAllDocumentData(); // Re-fetch data to show new requests
    setLoading(false);
  };
  // --- END MODIFIED handleSendForSignature FUNCTION ---

  const handleCancelDocument = async () => {
    if (!doc || !user) return;

    if (
      !window.confirm(
        "Are you sure you want to cancel this document and all pending signature requests? This action cannot be undone."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const { error: docUpdateError } = await supabase
        .from("documents")
        .update({
          status: "cancelled",
        })
        .eq("id", doc.id)
        .eq("owner_id", user.id);

      if (docUpdateError) {
        throw docUpdateError;
      }

      const { error: reqUpdateError } = await supabase
        .from("signature_requests")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by_user_id: user.id,
        })
        .eq("document_id", doc.id)
        .in("status", ["pending", "declined", "expired"]);

      if (reqUpdateError) {
        console.warn(
          "Could not update all related signature requests to cancelled:",
          reqUpdateError
        );
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        user_email: user.email,
        event_type: "DOCUMENT_CANCELLED",
        document_id: doc.id,
        details: { cancellation_reason: "Cancelled by sender", old_status: doc.status },
      });

      setNotification({
        message: "Document and all pending signature requests have been cancelled.",
        type: "success",
      });

      await fetchAllDocumentData();
    } catch (error) {
      console.error("Error cancelling document:", error);
      setNotification({
        message: `Failed to cancel document: ${error.message}`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- MODIFIED handleReportIssue FUNCTION ---
  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!issueDescription.trim()) {
      setNotification({ message: "Please provide a description for the issue.", type: "error" });
      return;
    }

    setLoading(true);
    setShowIssueModal(false);

    try {
      const { error } = await supabase.from("incident_reports").insert([
        // Changed to incident_reports
        {
          document_id: doc.id,
          reported_by_user_id: user.id,
          reported_by_email: issueContactEmail,
          reason: "User Reported Issue", // Added a default reason
          details: issueDescription, // Mapped to 'details' column
          status: "pending", // Default status as per your schema
        },
      ]);

      if (error) {
        throw error;
      }

      setNotification({
        message: "Your issue has been reported successfully. We will look into it shortly.",
        type: "success",
      });
      setIssueDescription("");
    } catch (error) {
      console.error("Error reporting issue:", error);
      setNotification({ message: `Failed to report issue: ${error.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };
  // --- END MODIFIED handleReportIssue FUNCTION ---

  const filteredSignatureRequests = selectedVersionForSignatures
    ? signatureRequests.filter((req) => req.document_version_id === selectedVersionForSignatures)
    : signatureRequests;

  // --- Render Logic (No major changes here, mainly in the Modal content) ---
  if (loading) {
    return (
      <div className="bg-brand-bg-light min-h-[calc(100vh-var(--navbar-height,0px))] p-10 font-inter text-brand-text flex flex-col items-center justify-center">
        <h1 className="text-5xl font-extrabold text-brand-heading mb-2 drop-shadow-sm text-center break-words">
          Document Details
        </h1>
        <p className="text-xl text-brand-text-light text-center">Loading document details...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="bg-brand-bg-light min-h-[calc(100vh-var(--navbar-height,0px))] p-10 font-inter text-brand-text flex flex-col items-center justify-center">
        <h1 className="text-5xl font-extrabold text-brand-heading mb-2 drop-shadow-sm text-center break-words">
          Document Not Found
        </h1>
        <p className="text-xl text-brand-text-light text-center mb-10">
          The document you are looking for does not exist or you do not have permission to view it.
        </p>
        <Link
          to="/user/documents"
          className="bg-gray-500 text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-gray-600 hover:translate-y-[-2px]"
        >
          Back to My Documents
        </Link>
      </div>
    );
  }

  const isDocumentOwner = user && doc.owner_id === user.id;
  const canModifyDocument =
    isDocumentOwner && doc.status !== "signed" && doc.status !== "cancelled";
  const canCancelDocument = isDocumentOwner && doc.status === "pending_signature";

  const currentFileVersion = doc.current_document_version;
  const viewableFileTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif"];

  const getStatusBadgeClasses = (status) => {
    switch (status) {
      case "draft":
        return "bg-color-info-bg text-color-info-text";
      case "pending_signature":
        return "bg-color-warning-bg text-color-warning-text";
      case "signed":
        return "bg-color-success-bg text-color-success-text";
      case "cancelled":
        return "bg-color-error-bg text-color-error-text";
      case "approved":
        return "bg-color-success-bg text-color-success-text";
      case "rejected":
        return "bg-color-error-bg text-color-error-text";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="bg-brand-bg-light min-h-[calc(100vh-var(--navbar-height,0px))] p-6 md:p-10 font-inter text-brand-text flex flex-col items-center">
      {notification.message && (
        <Notification message={notification.message} type={notification.type} />
      )}

      <div className="w-full max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-extrabold text-brand-heading mb-3 drop-shadow-sm text-center break-words">
          {doc.title}
        </h1>
        <p className="text-lg md:text-xl text-brand-text-light mb-8 text-center">
          Comprehensive details and management for your document.
        </p>

        {/* Cancellation Notice */}
        {doc.status === "cancelled" && (
          <div className="bg-color-error-bg text-color-error-text border-2 border-color-error-border rounded-xl p-4 mb-8 text-center text-lg font-semibold">
            <p>
              ⚠️ This document has been <strong>cancelled</strong> by the sender and is no longer
              valid for signing.
            </p>
          </div>
        )}

        {/* Document Overview & Actions Section */}
        <div className="bg-brand-card rounded-xl shadow-lg p-6 md:p-8 border border-brand-border mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left: Document Details */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-brand-heading mb-4 pb-2 border-b border-brand-border-light">
                Document Summary
              </h2>
              <div className="text-base md:text-lg mb-2 text-brand-text">
                <strong>Title:</strong>{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="p-1 border border-brand-border rounded-md text-base text-brand-text bg-brand-bg-dark-accent w-full"
                  />
                ) : (
                  <span>{doc.title}</span>
                )}
              </div>
              <div className="text-base md:text-lg mb-2 text-brand-text flex items-center gap-2">
                <strong>Status:</strong>{" "}
                <span
                  className={`px-3 py-1 rounded-md text-sm font-semibold ${getStatusBadgeClasses(
                    doc.status
                  )}`}
                >
                  {doc.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-base md:text-lg mb-2 text-brand-text">
                <strong>Created:</strong> {new Date(doc.created_at).toLocaleDateString()}
              </div>
              <div className="text-base md:text-lg mb-2 text-brand-text">
                <strong>Last Updated:</strong> {new Date(doc.updated_at).toLocaleDateString()}
              </div>
              <div className="text-base md:text-lg mb-2 text-brand-text">
                <strong>Latest Version:</strong> {doc.latest_version_number}
              </div>
              <div className="text-base md:text-lg text-brand-text">
                <strong>Description:</strong>{" "}
                {isEditing ? (
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="p-1 border border-brand-border rounded-md text-base text-brand-text bg-brand-bg-dark-accent w-full h-20 resize-y"
                    rows="3"
                  />
                ) : (
                  <span>{doc.description || "No description provided."}</span>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="md:border-l md:border-brand-border-light md:pl-6 pt-6 md:pt-0">
              <h2 className="text-2xl md:text-3xl font-bold text-brand-heading mb-4 pb-2 border-b border-brand-border-light">
                Actions
              </h2>
              <div className="flex flex-col gap-4">
                {canModifyDocument ? (
                  <>
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSaveDocumentDetails}
                          className="bg-color-success text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-color-success-hover hover:translate-y-[-2px]"
                        >
                          Save Details
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="bg-gray-500 text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-gray-600 hover:translate-y-[-2px]"
                        >
                          Cancel Edit
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="bg-color-info text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-color-info-hover hover:translate-y-[-2px]"
                      >
                        Edit Details
                      </button>
                    )}
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="bg-color-secondary text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-color-secondary-hover hover:translate-y-[-2px]"
                    >
                      Upload New Version
                    </button>
                    <button
                      onClick={() => setShowSignRequestModal(true)}
                      className="bg-color-secondary text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-color-secondary-hover hover:translate-y-[-2px]"
                    >
                      Send for Signature
                    </button>
                  </>
                ) : (
                  <p className="text-brand-text-light italic">
                    Document status ({doc.status.replace(/_/g, " ")}) prevents further
                    modifications.
                  </p>
                )}

                {canCancelDocument && (
                  <button
                    onClick={handleCancelDocument}
                    className="bg-color-error text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-color-error-hover hover:translate-y-[-2px]"
                  >
                    Cancel Document
                  </button>
                )}

                {currentFileVersion && (
                  <button
                    onClick={() =>
                      handleDownload(currentFileVersion.file_path, currentFileVersion.file_name)
                    }
                    className="bg-color-button-primary text-white px-6 py-3 rounded-full font-bold text-lg cursor-pointer transition duration-300 ease-in-out shadow-md hover:bg-color-button-primary-hover hover:translate-y-[-2px]"
                  >
                    Download Current Version
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Document Viewer Section */}
        <div className="bg-brand-card rounded-xl shadow-lg p-6 md:p-8 border border-brand-border mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-brand-heading mb-4 pb-2 border-b border-brand-border-light">
            Document Preview
          </h2>
          {currentFileVersion && viewableFileTypes.includes(currentFileVersion.file_type) ? (
            <DocumentViewer
              filePath={currentFileVersion.file_path}
              fileType={currentFileVersion.file_type}
            />
          ) : currentFileVersion ? (
            <p className="italic text-brand-text-light text-center p-5 border border-dashed border-brand-border-light rounded-lg">
              No preview available for this file type ({currentFileVersion.file_type}). Please
              download to view.
            </p>
          ) : (
            <p className="italic text-brand-text-light text-center p-5 border border-dashed border-brand-border-light rounded-lg">
              No current version to preview. Please upload a version.
            </p>
          )}
        </div>

        {/* Signature Requests and Versions Tabs */}
        <div className="bg-brand-card rounded-xl shadow-lg p-6 md:p-8 border border-brand-border mb-8">
          <div className="flex border-b border-brand-border-light mb-6">
            <button
              className={`px-4 py-2 text-lg font-semibold ${
                activeTab === "requests"
                  ? "border-b-2 border-color-button-primary text-color-button-primary"
                  : "text-brand-text-light hover:text-brand-heading"
              }`}
              onClick={() => setActiveTab("requests")}
            >
              Signature Requests
            </button>
            <button
              className={`ml-4 px-4 py-2 text-lg font-semibold ${
                activeTab === "versions"
                  ? "border-b-2 border-color-button-primary text-color-button-primary"
                  : "text-brand-text-light hover:text-brand-heading"
              }`}
              onClick={() => setActiveTab("versions")}
            >
              Document Versions
            </button>
          </div>

          {activeTab === "requests" && (
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-brand-heading mb-4">
                Signature Requests
              </h3>
              <div className="mb-4">
                <label
                  htmlFor="version-select"
                  className="block text-brand-text mb-2 text-lg font-medium"
                >
                  Select Document Version:
                </label>
                <select
                  id="version-select"
                  value={selectedVersionForSignatures}
                  onChange={(e) => setSelectedVersionForSignatures(e.target.value)}
                  className="w-full md:w-1/2 p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-color-button-primary focus:border-color-button-primary"
                >
                  <option value="">All Versions</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      Version {version.version_number} (
                      {new Date(version.created_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {filteredSignatureRequests.length === 0 ? (
                <p className="italic text-brand-text-light text-center p-5 border border-dashed border-brand-border-light rounded-lg">
                  No signature requests found for the selected version.
                </p>
              ) : (
                <ul className="list-none p-0 m-0">
                  {filteredSignatureRequests.map((request) => (
                    <li
                      key={request.id}
                      className="bg-brand-bg-dark-accent rounded-lg p-4 mb-3 border border-brand-border last:mb-0 transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2 text-brand-heading">
                        <div className="flex items-center gap-3">
                          <strong className="text-lg">Signer:</strong>
                          <span className="text-lg">
                            {request.signer?.full_name || request.signer_email}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-semibold ${getStatusBadgeClasses(
                              request.status
                            )}`}
                          >
                            {request.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="text-brand-text-light text-sm">
                          Requested on: {new Date(request.requested_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-brand-text-light mb-2">
                        Version:{" "}
                        <span className="font-semibold">
                          {versions.find((v) => v.id === request.document_version_id)
                            ?.version_number || "N/A"}
                        </span>
                      </div>
                      {request.status === "signed" && request.signed_at && (
                        <div className="text-sm text-brand-text-light mb-2">
                          Signed on: {new Date(request.signed_at).toLocaleDateString()}
                        </div>
                      )}
                      {request.status === "declined" && request.declined_at && (
                        <div className="text-sm text-brand-text-light mb-2">
                          Declined on: {new Date(request.declined_at).toLocaleDateString()}
                        </div>
                      )}
                      {request.status === "cancelled" && request.cancelled_at && (
                        <div className="text-sm text-brand-text-light mb-2">
                          Cancelled on: {new Date(request.cancelled_at).toLocaleDateString()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "versions" && (
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-brand-heading mb-4">
                Document Versions
              </h3>
              {versions.length === 0 ? (
                <p className="italic text-brand-text-light text-center p-5 border border-dashed border-brand-border-light rounded-lg">
                  No previous versions of this document exist.
                </p>
              ) : (
                <ul className="list-none p-0 m-0">
                  {versions.map((version) => (
                    <li
                      key={version.id}
                      className="bg-brand-bg-dark-accent rounded-lg p-4 mb-3 border border-brand-border last:mb-0 transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2 text-brand-heading">
                        <strong className="text-lg">Version {version.version_number}</strong>
                        <span className="text-brand-text-light text-sm">
                          Uploaded on: {new Date(version.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-base text-brand-text mb-1">
                        File: {version.file_name} ({formatFileSize(version.file_size)})
                      </p>
                      <p className="text-sm text-brand-text-light mb-2">
                        Changes: {version.description_of_changes || "No description provided."}
                      </p>
                      {version.is_signed_version && (
                        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-color-success-bg text-color-success-text mr-2">
                          SIGNED VERSION
                        </span>
                      )}
                      <button
                        onClick={() => handleDownload(version.file_path, version.file_name)}
                        className="mt-2 bg-color-button-secondary text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-color-button-secondary-hover transition duration-300 ease-in-out"
                      >
                        Download Version
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Report an Issue Button */}
        <div className="text-center mt-10">
          <button
            onClick={() => setShowIssueModal(true)}
            className="bg-gray-700 text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-gray-800 hover:translate-y-[-2px]"
          >
            Report an Issue
          </button>
        </div>
      </div>

      {/* Upload New Version Modal */}
      <Modal
        show={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload New Document Version"
      >
        <form onSubmit={handleNewVersionUpload} className="space-y-4">
          <div>
            <label
              htmlFor="newVersionFile"
              className="block text-brand-text text-lg font-medium mb-2"
            >
              Select File:
            </label>
            <input
              type="file"
              id="newVersionFile"
              ref={fileInputRef}
              onChange={(e) => setNewVersionFile(e.target.files[0])}
              className="w-full p-2 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-color-button-secondary file:text-white hover:file:bg-color-button-secondary-hover"
              required
            />
          </div>
          <div>
            <label
              htmlFor="newVersionDescription"
              className="block text-brand-text text-lg font-medium mb-2"
            >
              Description of Changes (Optional):
            </label>
            <textarea
              id="newVersionDescription"
              value={newVersionDescription}
              onChange={(e) => setNewVersionDescription(e.target.value)}
              rows="3"
              className="w-full p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-color-button-primary focus:border-color-button-primary"
              placeholder="e.g., Fixed typos, Added new clause, Minor revisions"
            ></textarea>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="px-6 py-2 rounded-full border border-gray-300 text-brand-text font-semibold hover:bg-gray-100 transition duration-300 ease-in-out"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-color-button-primary text-white px-6 py-2 rounded-full font-semibold hover:bg-color-button-primary-hover transition duration-300 ease-in-out"
            >
              Upload Version
            </button>
          </div>
        </form>
      </Modal>

      {/* Send for Signature Modal */}
      <Modal
        show={showSignRequestModal}
        onClose={() => setShowSignRequestModal(false)}
        title="Send Document for Signature"
      >
        <form onSubmit={handleSendForSignature} className="space-y-4">
          <p className="text-brand-text-light mb-4">
            Enter one or more signer email addresses, separated by commas, semicolons, or new lines.
            A signature request will be sent for the current version of the document (Version{" "}
            {doc?.current_document_version?.version_number || "N/A"}).
          </p>
          <div>
            <label
              htmlFor="signerEmails"
              className="block text-brand-text text-lg font-medium mb-2"
            >
              Signer Email(s):
            </label>
            <textarea
              id="signerEmails"
              value={signerEmailsInput}
              onChange={(e) => setSignerEmailsInput(e.target.value)}
              rows="5"
              className="w-full p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-color-button-primary focus:border-color-button-primary"
              placeholder="signer1@example.com, signer2@example.com"
              required
            ></textarea>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowSignRequestModal(false)}
              className="px-6 py-2 rounded-full border border-gray-300 text-brand-text font-semibold hover:bg-gray-100 transition duration-300 ease-in-out"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-color-button-primary text-white px-6 py-2 rounded-full font-semibold hover:bg-color-button-primary-hover transition duration-300 ease-in-out"
            >
              Send Request(s)
            </button>
          </div>
        </form>
      </Modal>

      {/* Report an Issue Modal */}
      <Modal show={showIssueModal} onClose={() => setShowIssueModal(false)} title="Report an Issue">
        <form onSubmit={handleReportIssue} className="space-y-4">
          <p className="text-brand-text-light mb-4">
            Please describe the issue you are experiencing with this document or the platform.
            Provide as much detail as possible.
          </p>
          <div>
            <label
              htmlFor="issueDescription"
              className="block text-brand-text text-lg font-medium mb-2"
            >
              Issue Description:
            </label>
            <textarea
              id="issueDescription"
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows="6"
              className="w-full p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-color-button-primary focus:border-color-button-primary"
              placeholder="e.g., Document is not rendering correctly, Signature request failed for a signer, Typo in document details"
              required
            ></textarea>
          </div>
          <div>
            <label
              htmlFor="issueContactEmail"
              className="block text-brand-text text-lg font-medium mb-2"
            >
              Your Email (for follow-up):
            </label>
            <input
              type="email"
              id="issueContactEmail"
              value={issueContactEmail}
              onChange={(e) => setIssueContactEmail(e.target.value)}
              className="w-full p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-color-button-primary focus:border-color-button-primary"
              placeholder="your.email@example.com"
              required
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowIssueModal(false)}
              className="px-6 py-2 rounded-full border border-gray-300 text-brand-text font-semibold hover:bg-gray-100 transition duration-300 ease-in-out"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-color-error text-white px-6 py-2 rounded-full font-semibold hover:bg-color-error-hover transition duration-300 ease-in-out"
            >
              Submit Report
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DocumentDetailsPage;
