import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient"; // Adjust path as needed
import { useNavigate } from "react-router-dom";
import Notification from "../components/Notification"; // Assuming you have this component

const SignatureRequestsListPage = () => {
  const [signatureRequests, setSignatureRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("sent"); // 'sent' or 'received'
  const [currentUser, setCurrentUser] = useState(null); // To store current user data

  const navigate = useNavigate();

  useEffect(() => {
    getSessionAndFetchRequests();
  }, [activeTab, filterStatus, searchTerm]); // Depend on all filter states and activeTab

  const getSessionAndFetchRequests = async () => {
    setLoading(true);
    setNotification({ message: "", type: "" }); // Clear previous notifications

    if (!supabase) {
      setNotification({
        message: "Supabase client not available. Please check configuration.",
        type: "error",
      });
      setLoading(false);
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setNotification({
        message: sessionError.message || "Failed to get user session.",
        type: "error",
      });
      setLoading(false);
      return;
    }

    if (!session?.user) {
      setNotification({
        message: "You must be logged in to view signature requests.",
        type: "error",
      });
      setLoading(false);
      return;
    }

    setCurrentUser(session.user);
    const currentUserId = session.user.id;
    const currentUserEmail = session.user.email;

    try {
      setLoading(true);
      let rawFetchedRequests = []; // This will hold the raw data after initial Supabase fetch and processing

      // The select query is fine, make sure it includes document_versions.version_number
      let query = supabase.from("signature_requests").select(
        `
          id,
          signer_email,
          status,
          requested_at,
          signed_at,
          declined_at,
          cancelled_at,
          voided_at,
          signature_data_path,
          document_id,
          document_version_id,
          documents (
            id,
            title,
            owner_id
          ),
          document_versions (
            id,
            version_number,
            file_name
          )
          `
      );

      if (activeTab === "sent") {
        // Logic for 'Sent by me' tab: fetch all requests where the current user is the document owner
        query = query.eq("documents.owner_id", currentUserId);
        const { data, error } = await query;
        if (error) throw error;
        rawFetchedRequests = data;
      } else {
        // --- CORRECTED LOGIC FOR 'Requested from me' tab ---
        // Fetch all requests where the current user is the signer
        query = query.eq("signer_email", currentUserEmail);
        const { data: allReceivedRequests, error } = await query;
        if (error) throw error;

        const latestActionableRequestsMap = new Map(); // Map<document_id, {version_number: number, request: object}>
        const historicalRequests = []; // Array of signed, cancelled, void requests

        allReceivedRequests.forEach((req) => {
          // Ensure document_versions data exists and has a valid version_number
          // If version_number is null or not a number, skip this request as its version cannot be determined.
          if (!req.document_versions || typeof req.document_versions.version_number !== "number") {
            console.warn(
              `Skipping request ${req.id} due to missing or invalid document_versions.version_number.`,
              req
            );
            return;
          }

          const docId = req.document_id;
          const currentVersionNumber = req.document_versions.version_number;

          if (["pending", "declined", "expired"].includes(req.status)) {
            // This is a potentially actionable request. We only want the latest *actionable* version for this document.
            const existingEntry = latestActionableRequestsMap.get(docId);

            if (!existingEntry || currentVersionNumber > existingEntry.version_number) {
              // If no entry exists for this document, or if this request is a newer version,
              // then set this as the latest actionable request for this document.
              latestActionableRequestsMap.set(docId, {
                version_number: currentVersionNumber,
                request: req,
              });
            }
          } else if (["signed", "cancelled", "void"].includes(req.status)) {
            // These are historical/finalized requests. Always include them, regardless of version.
            historicalRequests.push(req);
          }
        });

        // Extract the actual request objects from the map (these are the single latest actionable requests per document)
        const latestActionableRequests = Array.from(latestActionableRequestsMap.values()).map(
          (entry) => entry.request
        );

        // Combine the latest actionable requests with the historical requests.
        // Use a Map for final combination to automatically handle any potential duplicates by request ID.
        const combinedRequestsMap = new Map();
        latestActionableRequests.forEach((req) => combinedRequestsMap.set(req.id, req));
        historicalRequests.forEach((req) => combinedRequestsMap.set(req.id, req)); // Historical requests might overwrite if same ID, which is correct

        rawFetchedRequests = Array.from(combinedRequestsMap.values());
      }

      // --- Common mapping and filtering for both tabs (this part is largely correct) ---
      const mappedRequests = rawFetchedRequests.map((req) => ({
        ...req,
        document_id: req.documents?.id,
        document_title: req.documents?.title || "N/A",
        document_owner_id: req.documents?.owner_id,
        document_version_id: req.document_versions?.id,
        document_version_number: req.document_versions?.version_number || 0, // Default to 0 if null/undefined
      }));

      // Apply client-side filtering for status and search term to the final list
      const finalFilteredRequests = mappedRequests.filter((request) => {
        const matchesStatus = filterStatus === "all" || request.status === filterStatus;
        const matchesSearch =
          request.document_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          request.signer_email?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
      });

      // Sort the final list (e.g., by requested_at descending for latest first)
      finalFilteredRequests.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

      setSignatureRequests(finalFilteredRequests);
    } catch (err) {
      setNotification({
        message: err.message || "Failed to fetch signature requests.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Simplified and consolidated getStatusClasses for consistency
  const getStatusClasses = (status) => {
    switch (status) {
      case "pending":
        return "bg-color-warning-bg text-color-warning-text";
      case "signed":
        return "bg-color-success-bg text-color-success-text";
      case "declined":
        return "bg-color-error-bg text-color-error-text";
      case "cancelled":
        return "bg-gray-400 text-gray-800"; // Changed to grey for cancelled as well
      case "expired":
        return "bg-color-info-bg text-color-info-text";
      case "void": // Explicitly handle 'void' status
        return "bg-gray-500 text-white"; // A distinct, slightly darker grey for voided
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  // --- Action Handlers (kept mostly same as before, they affect single requests) ---
  const updateRequestStatusLocally = (
    id,
    newStatus,
    timestampField = null,
    timestampValue = null
  ) => {
    setSignatureRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? {
              ...req,
              status: newStatus,
              ...(timestampField && { [timestampField]: timestampValue }),
            }
          : req
      )
    );
  };

  const handleCancelRequest = async (id) => {
    if (!currentUser) {
      setNotification({ message: "User not authenticated.", type: "error" });
      return;
    }
    if (!window.confirm("Are you sure you want to cancel this request? This cannot be undone."))
      return;
    setLoading(true);

    const cancelledAt = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from("signature_requests")
        .update({
          status: "cancelled",
          cancelled_at: cancelledAt,
          cancelled_by_user_id: currentUser.id,
        })
        .eq("id", id);

      if (error) {
        if (error.code === "42501") {
          setNotification({
            message: "Permission denied. Check Supabase Row Level Security policies.",
            type: "error",
          });
        } else {
          setNotification({ message: "Failed to cancel request: " + error.message, type: "error" });
        }
        throw error;
      }

      updateRequestStatusLocally(id, "cancelled", "cancelled_at", cancelledAt);
      setNotification({ message: "Signature request cancelled successfully.", type: "success" });

      await supabase.from("audit_logs").insert({
        user_id: currentUser.id,
        user_email: currentUser.email,
        event_type: "SIGNATURE_REQUEST_CANCELLED",
        signature_request_id: id,
        details: { status: "cancelled" },
      });
    } catch (error) {
      if (!notification.message) {
        setNotification({
          message: "An unexpected error occurred during cancellation.",
          type: "error",
        });
      }
    } finally {
      setLoading(false);
      getSessionAndFetchRequests(); // Re-fetch to update UI based on new state/filters
    }
  };

  const handleRejectRequest = async (id) => {
    if (!currentUser) {
      setNotification({ message: "User not authenticated.", type: "error" });
      return;
    }
    if (!window.confirm("Are you sure you want to reject this document?")) return;
    setLoading(true);

    const declinedAt = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from("signature_requests")
        .update({
          status: "declined",
          declined_at: declinedAt,
        })
        .eq("id", id);

      if (error) {
        if (error.code === "42501") {
          setNotification({
            message: "Permission denied. Check Supabase Row Level Security policies.",
            type: "error",
          });
        } else {
          setNotification({ message: "Failed to reject request: " + error.message, type: "error" });
        }
        throw error;
      }

      updateRequestStatusLocally(id, "declined", "declined_at", declinedAt);
      setNotification({ message: "Signature request rejected.", type: "success" });

      await supabase.from("audit_logs").insert({
        user_id: currentUser.id,
        user_email: currentUser.email,
        event_type: "SIGNATURE_REQUEST_DECLINED",
        signature_request_id: id,
        details: { status: "declined" },
      });
    } catch (error) {
      if (!notification.message) {
        setNotification({
          message: "An unexpected error occurred during rejection.",
          type: "error",
        });
      }
    } finally {
      setLoading(false);
      getSessionAndFetchRequests();
    }
  };

  const handleSignRequest = async (id) => {
    if (!currentUser) {
      setNotification({ message: "User not authenticated.", type: "error" });
      return;
    }
    if (!window.confirm("Are you sure you want to sign this document?")) return;
    setLoading(true);

    const signedAt = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from("signature_requests")
        .update({
          status: "signed",
          signed_at: signedAt,
        })
        .eq("id", id);

      if (error) {
        if (error.code === "42501") {
          setNotification({
            message: "Permission denied. Check Supabase Row Level Security policies.",
            type: "error",
          });
        } else {
          setNotification({ message: "Failed to sign document: " + error.message, type: "error" });
        }
        throw error;
      }

      updateRequestStatusLocally(id, "signed", "signed_at", signedAt);
      setNotification({ message: "Document signed successfully.", type: "success" });

      await supabase.from("audit_logs").insert({
        user_id: currentUser.id,
        user_email: currentUser.email,
        event_type: "DOCUMENT_SIGNED",
        signature_request_id: id,
        details: { status: "signed" },
      });
    } catch (error) {
      if (!notification.message) {
        setNotification({ message: "An unexpected error occurred during signing.", type: "error" });
      }
    } finally {
      setLoading(false);
      getSessionAndFetchRequests(); // Re-fetch all requests to ensure UI is fully updated
    }
  };

  const handleRemindSigner = async (signerEmail) => {
    setNotification({ message: `Sending reminder to ${signerEmail}... (Simulated)`, type: "info" });
    setTimeout(() => {
      setNotification({ message: `Reminder sent to ${signerEmail}!`, type: "success" });
    }, 1500);
  };

  const handleViewSignatureRequestDetails = (request) => {
    const docId = request.document_id || (request.documents && request.documents.id) || request.id;
    navigate(`/user/documents/${docId}`);
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
        <p className="text-xl">Loading signature requests...</p>
      </div>
    );
  if (notification.type === "error" && notification.message)
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
        <p className="text-xl text-color-error">Error: {notification.message}</p>
      </div>
    );

  return (
    <div className="container mx-auto p-4 md:p-8 animate-fade-in-up min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
      {notification.message && (
        <Notification message={notification.message} type={notification.type} />
      )}

      <header className="mb-8 border-b border-brand-border-light pb-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-brand-heading">
          Signature Requests
        </h1>
        <p className="text-brand-text-light mt-2">
          Manage all incoming and outgoing document signature requests.
        </p>
      </header>

      <section className="mb-6">
        <div className="flex border-b border-brand-border-light">
          <button
            className={`px-6 py-3 text-lg font-medium transition-colors duration-200
              ${
                activeTab === "sent"
                  ? "border-b-2 border-color-button-primary text-color-button-primary"
                  : "text-brand-text-light hover:text-brand-heading"
              }`}
            onClick={() => setActiveTab("sent")}
          >
            Sent by me
          </button>
          <button
            className={`px-6 py-3 text-lg font-medium transition-colors duration-200
              ${
                activeTab === "received"
                  ? "border-b-2 border-color-button-primary text-color-button-primary"
                  : "text-brand-text-light hover:text-brand-heading"
              }`}
            onClick={() => setActiveTab("received")}
          >
            Requested from me
          </button>
        </div>
      </section>

      <section className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="w-full md:w-1/2">
          <input
            type="text"
            placeholder="Search by document title or signer email..."
            className="w-full p-3 rounded-md border border-brand-border bg-brand-card text-brand-text placeholder-brand-text-light focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-auto flex flex-wrap gap-2">
          {["all", "pending", "signed", "declined", "cancelled", "expired", "void"].map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-md capitalize text-sm font-medium transition-colors duration-200
                ${
                  filterStatus === status
                    ? "bg-color-button-primary text-white hover:bg-color-button-primary-hover"
                    : "bg-brand-card text-brand-text border border-brand-border hover:bg-brand-bg-dark"
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>
      </section>

      {signatureRequests.length === 0 ? (
        <div className="bg-brand-card p-6 rounded-lg shadow-card text-center text-brand-text-light">
          <p className="text-lg">
            No signature requests found in the '{activeTab}' tab matching your criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {signatureRequests.map((request) => {
            return (
              <div
                key={request.id}
                className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border flex flex-col justify-between animate-fade-in-up"
              >
                <div>
                  <h3 className="text-xl font-semibold text-brand-heading mb-2">
                    {request.document_title}
                  </h3>
                  <p className="text-brand-text-light mb-4 text-sm">
                    {activeTab === "sent" ? (
                      <>
                        <span className="font-medium">To:</span> {request.signer_email}
                      </>
                    ) : (
                      <>
                        <span className="font-medium">From:</span>{" "}
                        {request.document_owner_id === currentUser?.id ? "Me" : "Document Owner"}
                      </>
                    )}
                  </p>
                  <p className="text-brand-text text-sm">
                    <span className="font-medium">Date Sent:</span>{" "}
                    {new Date(request.requested_at).toLocaleDateString()}
                  </p>
                  {request.status === "signed" && request.signed_at && (
                    <p className="text-brand-text text-sm">
                      <span className="font-medium">Signed:</span>{" "}
                      {new Date(request.signed_at).toLocaleDateString()}
                    </p>
                  )}
                  {request.status === "declined" && request.declined_at && (
                    <p className="text-brand-text text-sm">
                      <span className="font-medium">Declined:</span>{" "}
                      {new Date(request.declined_at).toLocaleDateString()}
                    </p>
                  )}
                  {request.status === "cancelled" && request.cancelled_at && (
                    <p className="text-brand-text text-sm">
                      <span className="font-medium">Cancelled:</span>{" "}
                      {new Date(request.cancelled_at).toLocaleDateString()}
                    </p>
                  )}
                  {request.status === "void" && request.voided_at && (
                    <p className="text-brand-text text-sm">
                      <span className="font-medium">Voided:</span>{" "}
                      {new Date(request.voided_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold self-start ${getStatusClasses(
                      request.status
                    )}`}
                  >
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    {request.document_version_number > 0 &&
                      ` (v${request.document_version_number})`}
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* Actions for 'Received' requests */}
                    {activeTab === "received" && request.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleSignRequest(request.id)}
                          className="flex-1 px-4 py-2 bg-color-button-primary text-white rounded-md hover:bg-color-button-primary-hover transition-colors duration-200 text-sm z-10 pointer-events-auto cursor-pointer"
                          disabled={loading}
                        >
                          Sign Document
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="flex-1 px-4 py-2 bg-color-error text-white rounded-md hover:bg-color-error-hover transition-colors duration-200 text-sm z-10 pointer-events-auto cursor-pointer"
                          disabled={loading}
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {/* Actions for 'Sent' requests */}
                    {activeTab === "sent" && request.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleRemindSigner(request.signer_email)}
                          className="flex-1 px-4 py-2 bg-color-secondary text-white rounded-md hover:bg-color-secondary-hover transition-colors duration-200 text-sm cursor-pointer"
                          disabled={loading}
                        >
                          Remind Signer
                        </button>
                        <button
                          onClick={() => handleCancelRequest(request.id)}
                          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200 text-sm cursor-pointer"
                          disabled={loading}
                        >
                          Cancel Request
                        </button>
                      </>
                    )}
                    {/* Always show View Signature Request Details button */}
                    <button
                      onClick={() => handleViewSignatureRequestDetails(request)}
                      className="flex-1 px-4 py-2 bg-brand-bg-dark text-brand-text rounded-md hover:bg-brand-border transition-colors duration-200 text-sm cursor-pointer"
                      disabled={loading}
                    >
                      View Details
                    </button>
                    {/* Show Download Signed button if signed and signature_data_path exists */}
                    {request.status === "signed" && request.signature_data_path && (
                      <a
                        href={request.signature_data_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center px-4 py-2 bg-color-success text-white rounded-md hover:bg-color-success-hover transition-colors duration-200 text-sm cursor-pointer"
                      >
                        Download Signed
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SignatureRequestsListPage;
