import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient"; // Assuming this path is correct for your Supabase client
import Notification from "../components/Notification";
import DocumentViewer from "../components/DocumentViewer";
import Modal from "../components/Modal";

// Helper function to parse and validate emails
const parseAndValidateEmails = (input) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const emails = input
    .split(/[,;\n]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  const validEmails = [];
  const invalidEmails = [];
  const seenEmails = new Set();

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

  const [showSignRequestModal, setShowSignRequestModal] = useState(false);
  const [signerEmailsInput, setSignerEmailsInput] = useState("");

  const [activeTab, setActiveTab] = useState("requests");

  const [selectedVersionForSignatures, setSelectedVersionForSignatures] = useState("");

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [issueContactEmail, setIssueContactEmail] = useState("");

  const fetchAuditLogsWithSignee = async (signatureRequestId) => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        `
        *,
        signature_request:signature_request_id (
          signer_email,
          signer:signer_id (
            full_name,
            title,
            department
          )
        )
      `
      )
      .eq("signature_request_id", signatureRequestId)
      .order("timestamp", { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  };
  // Function to fetch all document-related data
  const fetchAllDocumentData = async () => {
    setLoading(true);
    // Fetch current user
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
    setIssueContactEmail(currentUser.email || "");

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
      .eq("owner_id", currentUser.id)
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

      // Set initial selected version for signatures tab
      if (docData.current_document_version_id) {
        setSelectedVersionForSignatures(docData.current_document_version_id);
      } else if (versionsData.length > 0) {
        setSelectedVersionForSignatures(versionsData[0].id);
      }
    }

    // Fetch signature requests (with signer info)
    const { data: signRequestsData, error: signRequestsError } = await supabase
      .from("signature_requests")
      .select(
        `
        id, document_version_id, signer_email, status, requested_at, signed_at,
        declined_at, cancelled_at, signing_url,
        signer:signer_id (full_name, title, department)
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

  // Effect to fetch data on component mount or ID change
  useEffect(() => {
    fetchAllDocumentData();
  }, [id, navigate]);

  // Handler for downloading files
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

  // Handler for saving document details (title, description)
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

  // Handler for uploading a new document version
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
    // Sanitize file name to be URL-friendly and prevent issues
    const sanitizedFileName = newVersionFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = `${user.id}/${doc.id}/version_${newVersionNumber}_${sanitizedFileName}`;

    try {
      console.log("--- Starting New Version Upload ---");
      console.log("Document ID:", doc.id);
      console.log("Current Document Version ID (before new upload):", doc.current_document_version_id);
      console.log("New Version Number:", newVersionNumber);
      console.log("File Name:", newVersionFile.name);

      // 1. Upload the new file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage.from("documents").upload(filePath, newVersionFile, {
        cacheControl: "3600",
        upsert: false, // Do not overwrite existing files
      });

      if (uploadError) {
        console.error("Supabase Storage Upload Error:", uploadError);
        throw uploadError;
      }

      console.log("File uploaded to storage successfully:", uploadData.path);

      // 2. Void previous pending signature requests for the old version
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
            { returning: "representation" } // Return updated rows
          )
          .eq("document_id", doc.id)
          .eq("document_version_id", doc.current_document_version_id); // Only void requests for the *previous* version

        if (updateRequestsError) {
          console.error("Error voiding previous signature requests:", updateRequestsError);
          setNotification({
            message: "New version uploaded, but failed to void some old signature requests.",
            type: "warning",
          });
        } else {
          console.log("Previous signature requests update result:", data?.length, "requests updated to 'void'.");
          setNotification({
            message: `Previous signature requests voided.`,
            type: "info",
          });
        }
      } else {
        console.log("No previous document_version_id found. Skipping voiding of old requests.");
      }

      // 3. Insert new document version record
      const { data: versionData, error: versionError } = await supabase
        .from("document_versions")
        .insert([
          {
            document_id: doc.id,
            version_number: newVersionNumber,
            file_path: uploadData.path,
            file_name: newVersionFile.name,
            file_type: newVersionFile.type || "application/octet-stream", // Fallback type
            file_size: newVersionFile.size,
            created_by_user_id: user.id,
            description_of_changes: newVersionDescription,
            is_signed_version: false, // New version is not signed yet
          },
        ])
        .select()
        .single();

      if (versionError) {
        console.error("Document Version Insert Error:", versionError);
        // If version insert fails, try to remove the uploaded file to clean up
        await supabase.storage.from("documents").remove([uploadData.path]);
        throw versionError;
      }

      console.log("New document version inserted:", versionData);

      // 4. Update the main document record to reflect the new latest version
      const { error: docUpdateError } = await supabase
        .from("documents")
        .update({
          latest_version_number: newVersionNumber,
          current_document_version_id: versionData.id,
        })
        .eq("id", doc.id);

      if (docUpdateError) {
        console.error("Critical error: Failed to update document's current version:", docUpdateError);
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

      // Reset form fields and re-fetch all data to refresh UI
      setNewVersionFile(null);
      setNewVersionDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchAllDocumentData(); // Re-fetch all data to ensure UI is consistent
    } catch (error) {
      console.error("Overall New Version Upload Process Failed:", error);
      setNotification({ message: `Upload failed: ${error.message}`, type: "error" });
    } finally {
      setLoading(false);
      console.log("--- New Version Upload Process Finished ---");
    }
  };

  // Handler for sending signature requests
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

    const requestPromises = validEmails.map(async (email) => {
      try {
        // Generate a unique ID for the signature request
        const signatureRequestId = crypto.randomUUID();

        // Construct the signing URL. This URL will be used by the signer.
        // In a real application, this URL would point to your dedicated signing page.
        const signingUrl = `${window.location.origin}/user/sign/${signatureRequestId}`;

        // Check if a pending request already exists for this document version and signer
        const { data: existingRequests, error: existingReqError } = await supabase
          .from("signature_requests")
          .select("id")
          .eq("document_id", doc.id)
          .eq("document_version_id", doc.current_document_version_id)
          .eq("signer_email", email)
          .maybeSingle(); // Use maybeSingle to get null if no row found, or single row if one exists

        if (existingReqError) {
          throw existingReqError;
        }

        if (existingRequests) {
          // If a request already exists, mark it as such and skip insertion
          successfulRequests.push({ email, status: "already_sent" });
          return;
        }

        // Insert the new signature request into the database
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
          .single(); // Select the newly inserted row

        if (signRequestError) {
          throw signRequestError;
        }

        // Log the signature request event in audit_logs
        await supabase.from("audit_logs").insert({
          user_id: user.id, // The user who sent the request
          user_email: user.email,
          event_type: "SIGNATURE_REQUEST_SENT",
          document_id: doc.id,
          document_version_id: doc.current_document_version_id,
          signature_request_id: signatureRequest.id, // Link to the specific signature request
          details: {
            signer_email: email,
            signing_url: signingUrl,
            // Additional details about the request initiation can be added here
          },
        });

        successfulRequests.push({ email, id: signatureRequest.id, signing_url: signingUrl });
      } catch (error) {
        console.error(`Error sending signature request to ${email}:`, error);
        failedRequests.push({ email, error: error.message });
      }
    });

    // Wait for all requests to settle (complete or fail)
    await Promise.allSettled(requestPromises);

    // Update document status if requests were successful and status isn't already signed
    if (successfulRequests.length > 0 && doc.status !== "pending_signature" && doc.status !== "signed") {
      const { error: docStatusUpdateError } = await supabase.from("documents").update({ status: "pending_signature" }).eq("id", doc.id);

      if (docStatusUpdateError) {
        console.error("Failed to update document status after signature request:", docStatusUpdateError);
        setNotification({
          message: `Some signature requests sent, but document status update failed. Please check document status manually.`,
          type: "warning",
        });
      } else {
        setDoc((prev) => ({ ...prev, status: "pending_signature" }));
      }
    }

    // Construct notification message based on outcomes
    let notificationMessage = "";
    let notificationType = "success";

    if (successfulRequests.length > 0) {
      const sentCount = successfulRequests.filter((req) => req.status !== "already_sent").length;
      const alreadySentCount = successfulRequests.filter((req) => req.status === "already_sent").length;
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

    setSignerEmailsInput("");
    await fetchAllDocumentData(); // Re-fetch all data to ensure UI is consistent
    setLoading(false);
  };

  // Handler for cancelling a document
  const handleCancelDocument = async () => {
    if (!doc || !user) return; // Ensure doc and user are loaded

    // Confirmation dialog (using window.confirm as per existing code)
    if (!window.confirm("Are you sure you want to cancel this document and all pending signature requests? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    try {
      // Update document status to cancelled
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

      // Update related pending/declined/expired signature requests to cancelled
      const { error: reqUpdateError } = await supabase
        .from("signature_requests")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by_user_id: user.id,
        })
        .eq("document_id", doc.id)
        .in("status", ["pending", "declined", "expired"]); // Only cancel requests that are not yet signed

      if (reqUpdateError) {
        console.warn("Could not update all related signature requests to cancelled:", reqUpdateError);
        // Do not throw error here, as the document itself was cancelled successfully
      }

      // Log the document cancellation event in audit_logs
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

      await fetchAllDocumentData(); // Re-fetch all data to update UI
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

  // Handler for reporting an issue
  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!issueDescription.trim()) {
      setNotification({ message: "Please provide a description for the issue.", type: "error" });
      return;
    }

    setLoading(true);
    setShowIssueModal(false);

    try {
      // Assuming an 'incident_reports' table exists for issue tracking
      const { error } = await supabase.from("incident_reports").insert([
        {
          document_id: doc.id,
          reported_by_user_id: user.id,
          reported_by_email: issueContactEmail,
          reason: "User Reported Issue",
          details: issueDescription,
          status: "pending",
        },
      ]);

      if (error) {
        throw error;
      }

      setNotification({
        message: "Your issue has been reported successfully. We will look into it shortly.",
        type: "success",
      });
      setIssueDescription(""); // Clear form
    } catch (error) {
      console.error("Error reporting issue:", error);
      setNotification({ message: `Failed to report issue: ${error.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Filter signature requests based on selected version
  const filteredSignatureRequests = selectedVersionForSignatures ? signatureRequests.filter((req) => req.document_version_id === selectedVersionForSignatures) : signatureRequests;

  // Render loading state
  if (loading) {
    return (
      <div className="bg-brand-bg-light min-h-[calc(100vh-var(--navbar-height,0px))] p-10 font-inter text-brand-text flex flex-col items-center justify-center">
        <h1 className="text-5xl font-extrabold text-brand-heading mb-2 drop-shadow-sm text-center break-words">Document Details</h1>
        <p className="text-xl text-brand-text-light text-center">Loading document details...</p>
      </div>
    );
  }

  // Render not found state
  if (!doc) {
    return (
      <div className="bg-brand-bg-light min-h-[calc(100vh-var(--navbar-height,0px))] p-10 font-inter text-brand-text flex flex-col items-center justify-center">
        <h1 className="text-5xl font-extrabold text-brand-heading mb-2 drop-shadow-sm text-center break-words">Document Not Found</h1>
        <p className="text-xl text-brand-text-light text-center mb-10">The document you are looking for does not exist or you do not have permission to view it.</p>
        <Link
          to="/user/documents"
          className="bg-gray-500 text-white px-6 py-3 rounded-full font-semibold text-lg cursor-pointer transition duration-300 ease-in-out hover:bg-gray-600 hover:translate-y-[-2px]"
        >
          Back to My Documents
        </Link>
      </div>
    );
  }

  // Determine user permissions
  const isDocumentOwner = user && doc.owner_id === user.id;
  const canModifyDocument = isDocumentOwner && doc.status !== "signed" && doc.status !== "cancelled";
  const canCancelDocument = isDocumentOwner && doc.status === "pending_signature"; // Only allow cancellation if pending

  // Get current file version for preview
  const currentFileVersion = doc.current_document_version;
  // Define viewable file types
  const viewableFileTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif"]; // Added gif

  // Helper function for status badge styling
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
      case "approved": // Assuming these are possible statuses from your system
        return "bg-color-success-bg text-color-success-text";
      case "rejected": // Assuming these are possible statuses from your system
        return "bg-color-error-bg text-color-error-text";
      case "void": // For voided signature requests
        return "bg-gray-400 text-gray-900";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="bg-brand-bg-light min-h-[calc(100vh-var(--navbar-height,0px))] p-4 md:p-8 font-inter text-brand-text flex flex-col items-center antialiased">
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      {/* TOP SECTION: Title, Status, Description, Cancelled Alert */}
      <div className="w-full max-w-7xl mb-8 px-4 md:px-0">
        {" "}
        {/* Added px for smaller screens */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
          <h1 className="text-3xl md:text-4xl font-extrabold text-brand-heading drop-shadow-sm break-words tracking-tight flex-1">{doc.title}</h1>
          <span className={`px-4 py-1 rounded-full text-base font-semibold whitespace-nowrap mt-2 md:mt-0 ${getStatusBadgeClasses(doc.status)}`}>{doc.status.replace(/_/g, " ")}</span>
        </div>
        <p className="text-base md:text-lg text-brand-text-light mb-6 leading-relaxed">Comprehensive details and management for your document.</p>
        {doc.status === "cancelled" && (
          <div className="bg-color-error-bg text-color-error-text border-2 border-color-error-border rounded-xl p-4 text-center text-lg font-semibold flex items-center justify-center gap-3">
            <span className="text-2xl">⚠️</span>
            <p>
              This document has been <strong>cancelled</strong> by the sender and is no longer valid for signing.
            </p>
          </div>
        )}
      </div>

      {/* MAIN CONTENT GRID: Document Preview/Summary (Left) and Actions/Tabs (Right) */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Document Preview and Document Summary */}
        <div className="lg:col-span-7 flex flex-col gap-8 min-w-0">
          {" "}
          {/* Added gap-8 for spacing between cards */}
          <div className="bg-brand-card rounded-xl shadow-lg p-6 md:p-8 border border-brand-border">
            {" "}
            {/* Re-added padding */}
            <h2 className="text-2xl md:text-3xl font-bold text-brand-heading mb-4 pb-2 border-b border-brand-border-light">Document Preview</h2>
            {currentFileVersion && viewableFileTypes.includes(currentFileVersion.file_type) ? (
              <div className="rounded-lg overflow-hidden border border-brand-border-light bg-brand-bg-dark-accent h-[500px] lg:h-[600px] flex items-center justify-center">
                {" "}
                {/* Increased height for "big" preview */}
                <DocumentViewer filePath={currentFileVersion.file_path} fileType={currentFileVersion.file_type} />
              </div>
            ) : currentFileVersion ? (
              <p className="italic text-brand-text-light text-center p-5 border border-dashed border-brand-border-light rounded-lg h-[500px] lg:h-[600px] flex items-center justify-center">
                No preview available for this file type ({currentFileVersion.file_type}). Please download to view.
              </p>
            ) : (
              <p className="italic text-brand-text-light text-center p-5 border border-dashed border-brand-border-light rounded-lg h-[500px] lg:h-[600px] flex items-center justify-center">
                No current version to preview. Please upload a version.
              </p>
            )}
          </div>
          {/* Document Summary - now a separate card in the left column */}
          <div className="bg-brand-card rounded-xl shadow-lg p-6 md:p-8 border border-brand-border">
            <h2 className="text-2xl md:text-3xl font-bold text-brand-heading mb-4 pb-2 border-b border-brand-border-light">Document Summary</h2>
            <div className="text-base md:text-lg mb-2 text-brand-text">
              <strong>Title:</strong>{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="p-2 border border-brand-border rounded-md text-base text-brand-text bg-brand-bg-dark-accent w-full focus:ring-2 focus:ring-color-button-primary focus:border-transparent transition-all duration-200"
                />
              ) : (
                <span>{doc.title}</span>
              )}
            </div>
            {/* Status is moved to the top, so remove it from here */}
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
                  className="p-2 border border-brand-border rounded-md text-base text-brand-text bg-brand-bg-dark-accent w-full h-20 resize-y focus:ring-2 focus:ring-color-button-primary focus:border-transparent transition-all duration-200"
                  rows="3"
                ></textarea>
              ) : (
                <span>{doc.description || "No description provided."}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions and Tabs */}
        <div className="lg:col-span-5 flex flex-col gap-8 w-full">
          {" "}
          {/* Removed max-w-full, added gap-8 */}
          {/* Actions */}
          <div className="bg-brand-card rounded-xl shadow-lg p-6 md:p-8 border border-brand-border">
            <h2 className="text-2xl md:text-3xl font-bold text-brand-heading mb-4 pb-2 border-b border-brand-border-light">Actions</h2>
            <div className="flex flex-wrap gap-3">
              {canModifyDocument ? (
                <>
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveDocumentDetails}
                        className="bg-color-success text-white px-5 py-2 rounded-full font-semibold text-base cursor-pointer transition duration-300 ease-in-out hover:bg-color-success-hover hover:-translate-y-1 shadow-md"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-500 text-white px-5 py-2 rounded-full font-semibold text-base cursor-pointer transition duration-300 ease-in-out hover:bg-gray-600 hover:-translate-y-1 shadow-md"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-color-info text-white px-5 py-2 rounded-full font-semibold text-base cursor-pointer transition duration-300 ease-in-out hover:bg-color-info-hover hover:-translate-y-1 shadow-md"
                    >
                      Edit Details
                    </button>
                  )}
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-color-secondary text-white px-5 py-2 rounded-full font-semibold text-base cursor-pointer transition duration-300 ease-in-out hover:bg-color-secondary-hover hover:-translate-y-1 shadow-md"
                  >
                    Upload New Version
                  </button>
                  <button
                    onClick={() => setShowSignRequestModal(true)}
                    className="bg-color-secondary text-white px-5 py-2 rounded-full font-semibold text-base cursor-pointer transition duration-300 ease-in-out hover:bg-color-secondary-hover hover:-translate-y-1 shadow-md"
                  >
                    Send for Signature
                  </button>
                </>
              ) : (
                <p className="text-brand-text-light italic p-3 bg-brand-bg-dark-accent rounded-md border border-brand-border text-center w-full">
                  Document status ({doc.status.replace(/_/g, " ")}) prevents further modifications.
                </p>
              )}

              {canCancelDocument && (
                <button
                  onClick={handleCancelDocument}
                  className="bg-color-error text-white px-5 py-2 rounded-full font-semibold text-base cursor-pointer transition duration-300 ease-in-out hover:bg-color-error-hover hover:-translate-y-1 shadow-md"
                >
                  Cancel Document
                </button>
              )}

              {currentFileVersion && (
                <button
                  onClick={() => handleDownload(currentFileVersion.file_path, currentFileVersion.file_name)}
                  className="bg-color-button-primary text-white px-5 py-2 rounded-full font-bold text-base cursor-pointer transition duration-300 ease-in-out shadow-md hover:bg-color-button-primary-hover hover:-translate-y-1"
                >
                  Download Current Version
                </button>
              )}
            </div>
          </div>
          <div className="bg-brand-card rounded-xl shadow-lg p-0 border border-brand-border flex-1 flex flex-col overflow-hidden">
            <div className="flex border-b border-brand-border-light">
              <button
                className={`flex-1 px-4 py-3 text-base font-semibold rounded-t-lg ${
                  activeTab === "requests" ? "border-b-2 border-color-button-primary text-color-button-primary bg-brand-bg-light" : "text-brand-text-light hover:text-brand-heading"
                } transition-colors duration-200`}
                onClick={() => setActiveTab("requests")}
              >
                Signature Requests
              </button>
              <button
                className={`flex-1 px-4 py-3 text-base font-semibold rounded-t-lg ${
                  activeTab === "versions" ? "border-b-2 border-color-button-primary text-color-button-primary bg-brand-bg-light" : "text-brand-text-light hover:text-brand-heading"
                } transition-colors duration-200`}
                onClick={() => setActiveTab("versions")}
              >
                Document Versions
              </button>
            </div>

            <div className="p-6 md:p-8 flex-1 flex flex-col">
              {activeTab === "requests" && (
                <div className="flex flex-col h-full">
                  <div className="mb-4">
                    <label htmlFor="version-select" className="block text-brand-text mb-2 text-base font-medium">
                      Select Document Version:
                    </label>
                    <select
                      id="version-select"
                      value={selectedVersionForSignatures}
                      onChange={(e) => setSelectedVersionForSignatures(e.target.value)}
                      className="w-full p-2 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-2 focus:ring-color-button-primary focus:border-transparent transition-all duration-200"
                    >
                      <option value="">All Versions</option>
                      {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          Version {version.version_number} ({new Date(version.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {filteredSignatureRequests.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="italic text-brand-text-light text-center p-5 border border-dashed border-brand-border-light rounded-lg">No signature requests found for the selected version.</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-[340px] pr-1">
                      <ul className="list-none p-0 m-0 space-y-3">
                        {filteredSignatureRequests.map((request) => (
                          <li key={request.id} className="bg-brand-bg-dark-accent rounded-lg p-4 border border-brand-border transition-all duration-200 hover:shadow-md">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2 text-brand-heading">
                              <div className="flex items-center gap-3 flex-wrap">
                                <strong className="text-base">Signer:</strong>
                                <span className="text-base">{request.signer?.full_name || request.signer_email}</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClasses(request.status)}`}>{request.status.replace(/_/g, " ")}</span>
                              </div>
                              <span className="text-brand-text-light text-xs">Requested: {new Date(request.requested_at).toLocaleDateString()}</span>
                            </div>

                            <div className="text-xs text-brand-text-light mb-1">
                              {request.signer ? (
                                <>
                                  <div>
                                    <span className="font-semibold">Full Name:</span> {request.signer.full_name || "N/A"}
                                  </div>
                                  <div>
                                    <span className="font-semibold">Title:</span> {request.signer.title || "N/A"}
                                  </div>
                                  <div>
                                    <span className="font-semibold">Department:</span> {request.signer.department || "N/A"}
                                  </div>
                                </>
                              ) : (
                                <div>
                                  <span className="font-semibold">Email:</span> {request.signer_email}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-brand-text-light mb-1">
                              Version: <span className="font-semibold">{versions.find((v) => v.id === request.document_version_id)?.version_number || "N/A"}</span>
                            </div>
                            {request.status === "signed" && request.signed_at && <div className="text-xs text-brand-text-light mb-1">Signed: {new Date(request.signed_at).toLocaleDateString()}</div>}
                            {request.status === "declined" && request.declined_at && (
                              <div className="text-xs text-brand-text-light mb-1">Declined: {new Date(request.declined_at).toLocaleDateString()}</div>
                            )}
                            {request.status === "cancelled" && request.cancelled_at && (
                              <div className="text-xs text-brand-text-light mb-1">Cancelled: {new Date(request.cancelled_at).toLocaleDateString()}</div>
                            )}
                            <button
                              onClick={async () => {
                                setSelectedRequest(request);
                                setShowAuditModal(true);
                                setAuditLoading(true);
                                try {
                                  const logs = await fetchAuditLogsWithSignee(request.id);
                                  setAuditLogs(logs);
                                } catch (error) {
                                  console.error("Error fetching audit logs:", error.message);
                                  setNotification({ message: `Failed to fetch audit logs: ${error.message}`, type: "error" });
                                  setAuditLogs([]);
                                }
                                setAuditLoading(false);
                              }}
                              className="mt-2 bg-color-info text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-color-info-hover transition duration-300 ease-in-out shadow-sm"
                            >
                              See Audit
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "versions" && (
                <div className="flex-1 flex flex-col">
                  {versions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="italic text-brand-text-light text-center p-5 border border-dashed border-brand-border-light rounded-lg">No previous versions of this document exist.</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-[340px] pr-1">
                      <ul className="list-none p-0 m-0 space-y-3">
                        {versions.map((version) => (
                          <li key={version.id} className="bg-brand-bg-dark-accent rounded-lg p-4 border border-brand-border transition-all duration-200 hover:shadow-md">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2 text-brand-heading">
                              <strong className="text-base">Version {version.version_number}</strong>
                              <span className="text-brand-text-light text-xs">Uploaded: {new Date(version.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-brand-text mb-1">
                              File: {version.file_name} ({formatFileSize(version.file_size)})
                            </p>
                            <p className="text-xs text-brand-text-light mb-2">Changes: {version.description_of_changes || "No description provided."}</p>
                            {version.is_signed_version && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-color-success-bg text-color-success-text mr-2">SIGNED VERSION</span>}
                            <button
                              onClick={() => handleDownload(version.file_path, version.file_name)}
                              className="mt-2 bg-color-button-secondary text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-color-button-secondary-hover transition duration-300 ease-in-out shadow-sm"
                            >
                              Download Version
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="text-center">
            <button
              onClick={() => setShowIssueModal(true)}
              className="bg-gray-700 text-white px-6 py-3 rounded-full font-semibold text-base cursor-pointer transition duration-300 ease-in-out hover:bg-gray-800 hover:-translate-y-1 shadow-md"
            >
              Report an Issue
            </button>
          </div>
        </div>
      </div>

      {/* Modals (remain outside the main grid for consistent overlay behavior) */}
      <Modal show={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload New Document Version">
        <form onSubmit={handleNewVersionUpload} className="space-y-4">
          <div>
            <label htmlFor="newVersionFile" className="block text-brand-text text-base font-medium mb-2">
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
            <label htmlFor="newVersionDescription" className="block text-brand-text text-base font-medium mb-2">
              Description of Changes (Optional):
            </label>
            <textarea
              id="newVersionDescription"
              value={newVersionDescription}
              onChange={(e) => setNewVersionDescription(e.target.value)}
              rows="3"
              className="w-full p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-2 focus:ring-color-button-primary focus:border-transparent transition-all duration-200"
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
            <button type="submit" className="bg-color-button-primary text-white px-6 py-2 rounded-full font-semibold hover:bg-color-button-primary-hover transition duration-300 ease-in-out">
              Upload Version
            </button>
          </div>
        </form>
      </Modal>

      <Modal show={showSignRequestModal} onClose={() => setShowSignRequestModal(false)} title="Send Document for Signature">
        <form onSubmit={handleSendForSignature} className="space-y-4">
          <p className="text-brand-text-light mb-4">
            Enter one or more signer email addresses, separated by commas, semicolons, or new lines. A signature request will be sent for the current version of the document (Version{" "}
            {doc?.current_document_version?.version_number || "N/A"}).
          </p>
          <div>
            <label htmlFor="signerEmails" className="block text-brand-text text-base font-medium mb-2">
              Signer Email(s):
            </label>
            <textarea
              id="signerEmails"
              value={signerEmailsInput}
              onChange={(e) => setSignerEmailsInput(e.target.value)}
              rows="5"
              className="w-full p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-2 focus:ring-color-button-primary focus:border-transparent transition-all duration-200"
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
            <button type="submit" className="bg-color-button-primary text-white px-6 py-2 rounded-full font-semibold hover:bg-color-button-primary-hover transition duration-300 ease-in-out">
              Send Request(s)
            </button>
          </div>
        </form>
      </Modal>

      <Modal show={showIssueModal} onClose={() => setShowIssueModal(false)} title="Report an Issue">
        <form onSubmit={handleReportIssue} className="space-y-4">
          <p className="text-brand-text-light mb-4">Please describe the issue you are experiencing with this document or the platform. Provide as much detail as possible.</p>
          <div>
            <label htmlFor="issueDescription" className="block text-brand-text text-base font-medium mb-2">
              Issue Description:
            </label>
            <textarea
              id="issueDescription"
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows="6"
              className="w-full p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-2 focus:ring-color-button-primary focus:border-transparent transition-all duration-200"
              placeholder="e.g., Document is not rendering correctly, Signature request failed for a signer, Typo in document details"
              required
            ></textarea>
          </div>
          <div>
            <label htmlFor="issueContactEmail" className="block text-brand-text text-base font-medium mb-2">
              Your Email (for follow-up):
            </label>
            <input
              type="email"
              id="issueContactEmail"
              value={issueContactEmail}
              onChange={(e) => setIssueContactEmail(e.target.value)}
              className="w-full p-3 border border-brand-border rounded-md bg-brand-bg-dark-accent text-brand-text focus:ring-2 focus:ring-color-button-primary focus:border-transparent transition-all duration-200"
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
            <button type="submit" className="bg-color-error text-white px-6 py-2 rounded-full font-semibold hover:bg-color-error-hover transition duration-300 ease-in-out">
              Submit Report
            </button>
          </div>
        </form>
      </Modal>

      <Modal show={showAuditModal} onClose={() => setShowAuditModal(false)} title="Signature Audit Trail">
        {auditLoading ? (
          <div className="text-center py-8 text-brand-text-light">Loading audit logs...</div>
        ) : (
          <div>
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-brand-text-light">No audit logs found for this signature request.</div>
            ) : (
              <ul className="divide-y divide-brand-border">
                {auditLogs.map((log) => (
                  <li key={log.id} className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-brand-heading">{log.event_type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-brand-text-light">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-brand-text-light mt-1">
                      {log.details && typeof log.details === "object"
                        ? Object.entries(log.details).map(([k, v]) => (
                            <div key={k}>
                              <span className="font-semibold capitalize">{k.replace(/_/g, " ")}:</span>{" "}
                              <span>
                                {/* Special handling for signing_location if it's an object */}
                                {k === "signing_location" && typeof v === "object" && v !== null ? `Latitude: ${v.latitude}, Longitude: ${v.longitude}` : String(v)}
                              </span>
                            </div>
                          ))
                        : String(log.details)}{" "}
                      {/* Fallback for non-object details */}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DocumentDetailsPage;
