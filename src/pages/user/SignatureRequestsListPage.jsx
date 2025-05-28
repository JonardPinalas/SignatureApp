import React, { useState, useEffect, useCallback } from "react";
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6); // Number of items to display per page
  const [totalRequestsCount, setTotalRequestsCount] = useState(0); // Total count of filtered requests

  const navigate = useNavigate();

  /**
   * Fetches user meta information (IP, user agent, location) from Cloudflare APIs.
   * This information is used for audit logging when a document is signed.
   * @returns {Object} An object containing user's IP, user agent, and location details.
   */
  const getUserMetaInfo = async () => {
    try {
      const metaRes = await fetch("https://speed.cloudflare.com/meta");
      const meta = metaRes.ok ? await metaRes.json() : {};

      const traceRes = await fetch("https://cloudflare.tv/cdn-cgi/trace");
      const traceText = traceRes.ok ? await traceRes.text() : "";
      const trace = {};
      traceText.split("\n").forEach((line) => {
        const [key, ...rest] = line.split("=");
        if (key && rest.length) trace[key] = rest.join("=");
      });

      return {
        ip: meta.clientIp || trace.ip || null,
        userAgent: trace.uag || navigator.userAgent || null,
        location: {
          country: meta.country || trace.loc || null,
          city: meta.city || null,
          region: meta.region || null,
          latitude: meta.latitude || null,
          longitude: meta.longitude || null,
        },
        meta,
        trace,
      };
    } catch (e) {
      console.error("Error fetching user meta info:", e);
      return {
        ip: null,
        userAgent: navigator.userAgent || null,
        location: {},
        meta: {},
        trace: {},
      };
    }
  };

  /**
   * Fetches signature requests based on the active tab (sent/received),
   * current filters (status, search term), and pagination settings.
   * It applies filters and pagination directly in the Supabase query for efficiency.
   * This function is memoized using useCallback to prevent unnecessary re-renders.
   */
  const getSessionAndFetchRequests = useCallback(async () => {
    setLoading(true);
    setNotification({ message: "", type: "" }); // Clear previous notifications

    // Ensure Supabase client is available
    if (!supabase) {
      setNotification({
        message: "Supabase client not available. Please check configuration.",
        type: "error",
      });
      setLoading(false);
      return;
    }

    // Get current user session
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

    // Ensure user is logged in
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
      // Calculate the range for pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Build the base Supabase query
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
        `,
        { count: "exact" } // Request total count for pagination
      );

      // Apply tab-specific filter: 'sent' by owner_id, 'received' by signer_email
      if (activeTab === "sent") {
        query = query.eq("documents.owner_id", currentUserId);
      } else {
        // activeTab === "received"
        query = query.eq("signer_email", currentUserEmail);
      }

      // Apply status filter if not 'all'
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      // Apply search term filter using OR logic for document title and signer email.
      // Note: For complex joins and OR conditions, a Supabase View or Function might be more robust
      // if direct `or` with nested properties proves unreliable.
      if (searchTerm) {
        query = query.or(`documents.title.ilike.%${searchTerm}%,signer_email.ilike.%${searchTerm}%`);
      }

      // Order by 'requested_at' in descending order for consistent results across pages
      query = query.order("requested_at", { ascending: false });

      // Apply pagination range
      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error("Supabase fetch error:", error);
        // Provide specific error messages for common issues like RLS
        if (error.code === "42501") {
          setNotification({
            message: "Permission denied. Check Supabase Row Level Security policies.",
            type: "error",
          });
        } else {
          setNotification({ message: `Failed to fetch signature requests: ${error.message}`, type: "error" });
        }
        setSignatureRequests([]); // Clear requests on error
        setTotalRequestsCount(0); // Reset total count
      } else {
        setTotalRequestsCount(count); // Set the total count for pagination UI

        // Map the fetched data to a more convenient structure
        const mappedRequests = data.map((req) => ({
          ...req,
          document_id: req.documents?.id,
          document_title: req.documents?.title || "N/A",
          document_owner_id: req.documents?.owner_id,
          document_version_id: req.document_versions?.id,
          document_version_number: req.document_versions?.version_number || 0,
        }));
        setSignatureRequests(mappedRequests);
      }
    } catch (err) {
      console.error("Unexpected error during fetch:", err);
      setNotification({
        message: err.message || "An unexpected error occurred while fetching requests.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterStatus, searchTerm, currentPage, itemsPerPage]); // Dependencies for useCallback

  // Effect to reset page to 1 when filters or search term change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterStatus, searchTerm]);

  // Effect to fetch data when currentPage or other fetch dependencies change
  useEffect(() => {
    getSessionAndFetchRequests();
  }, [currentPage, getSessionAndFetchRequests]); // Depend on currentPage and the memoized callback

  /**
   * Returns Tailwind CSS classes based on the signature request status for styling.
   * @param {string} status - The status of the signature request.
   * @returns {string} Tailwind CSS classes.
   */
  const getStatusClasses = (status) => {
    switch (status) {
      case "pending":
        return "bg-color-warning-bg text-color-warning-text";
      case "signed":
        return "bg-color-success-bg text-color-success-text";
      case "declined":
        return "bg-color-error-bg text-color-error-text";
      case "cancelled":
        return "bg-gray-400 text-gray-800";
      case "expired":
        return "bg-color-info-bg text-color-info-text";
      case "void":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  /**
   * Updates the status of a signature request locally in the state.
   * This provides immediate UI feedback before a full data re-fetch.
   * @param {string} id - The ID of the request to update.
   * @param {string} newStatus - The new status to set.
   * @param {string} [timestampField=null] - The timestamp field to update (e.g., 'signed_at').
   * @param {string} [timestampValue=null] - The timestamp value.
   */
  const updateRequestStatusLocally = (id, newStatus, timestampField = null, timestampValue = null) => {
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

  /**
   * Handles actions (sign, reject, cancel) on a signature request.
   * Displays a custom confirmation dialog, updates the request status in Supabase,
   * logs the action in audit_logs, and then re-fetches the data.
   * @param {string} id - The ID of the signature request.
   * @param {string} documentId - The ID of the associated document.
   * @param {string} documentVersionId - The ID of the associated document version.
   * @param {string} actionType - The type of action ('sign', 'reject', 'cancel').
   */
  const handleAction = async (id, documentId, documentVersionId, actionType) => {
    if (!currentUser) {
      setNotification({ message: "User not authenticated.", type: "error" });
      return;
    }

    // Custom confirmation dialog (replaces window.confirm)
    const confirmed = await new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50";
      modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl text-center max-w-sm mx-auto">
          <p class="text-lg font-semibold mb-4 text-gray-800">${
            actionType === "cancel" ? "Are you sure you want to cancel this request? This cannot be undone." : `Are you sure you want to ${actionType} this document?`
          }</p>
          <div class="flex justify-center space-x-4">
            <button id="confirmBtn" class="px-5 py-2 bg-color-error text-white rounded-md hover:bg-red-600 transition-colors">Confirm</button>
            <button id="cancelBtn" class="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById("confirmBtn").onclick = () => {
        document.body.removeChild(modal);
        resolve(true);
      };
      document.getElementById("cancelBtn").onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };
    });

    if (!confirmed) return; // If user cancels the action

    setLoading(true);

    let newStatus = "";
    let timestampField = "";
    let eventType = "";
    let successMessage = "";

    // Determine status, timestamp field, event type, and success message based on action type
    switch (actionType) {
      case "sign":
        newStatus = "signed";
        timestampField = "signed_at";
        eventType = "DOCUMENT_SIGNED";
        successMessage = "Document signed successfully.";
        break;
      case "reject":
        newStatus = "declined";
        timestampField = "declined_at";
        eventType = "SIGNATURE_REQUEST_DECLINED";
        successMessage = "Signature request rejected.";
        break;
      case "cancel":
        newStatus = "cancelled";
        timestampField = "cancelled_at";
        eventType = "SIGNATURE_REQUEST_CANCELLED";
        successMessage = "Signature request cancelled successfully.";
        break;
      default:
        setNotification({ message: "Invalid action.", type: "error" });
        setLoading(false);
        return;
    }

    const actionTimestamp = new Date().toISOString();
    const userMeta = await getUserMetaInfo(); // Get user meta info for audit logging

    try {
      const updatePayload = {
        status: newStatus,
        [timestampField]: actionTimestamp,
      };

      // Add specific fields for 'sign' and 'cancel' actions
      if (actionType === "sign") {
        Object.assign(updatePayload, {
          signer_ip_address: userMeta.ip,
          signer_user_agent: userMeta.userAgent,
          signing_location: userMeta.location,
        });
      } else if (actionType === "cancel") {
        updatePayload.cancelled_by_user_id = currentUser.id;
      }

      // Update the signature request in Supabase
      const { error } = await supabase.from("signature_requests").update(updatePayload).eq("id", id);

      if (error) {
        if (error.code === "42501") {
          // Row Level Security error
          setNotification({
            message: "Permission denied. Check Supabase Row Level Security policies.",
            type: "error",
          });
        } else {
          setNotification({ message: `Failed to ${actionType} request: ` + error.message, type: "error" });
        }
        throw error; // Re-throw to be caught by the outer catch block
      }

      // Update local state for immediate UI feedback
      updateRequestStatusLocally(id, newStatus, timestampField, actionTimestamp);
      setNotification({ message: successMessage, type: "success" });

      // Log the action in the audit_logs table
      await supabase.from("audit_logs").insert({
        user_id: currentUser.id,
        user_email: currentUser.email,
        event_type: eventType,
        signature_request_id: id,
        document_id: documentId,
        document_version_id: documentVersionId,
        ip_address: userMeta.ip,
        details: {
          status: newStatus,
          userAgent: userMeta.userAgent,
          location: userMeta.location,
          ...(actionType === "cancel" && { cancelled_by_user_id: currentUser.id }),
        },
      });
    } catch (error) {
      // Only set a generic error if no specific error message was already set
      if (!notification.message) {
        setNotification({ message: `An unexpected error occurred during ${actionType}.`, type: "error" });
      }
    } finally {
      setLoading(false);
      // Re-fetch data to ensure consistency and re-apply filters/pagination
      getSessionAndFetchRequests();
    }
  };

  /**
   * Handles sending a reminder to a signer (simulated).
   * @param {string} signerEmail - The email of the signer to remind.
   */
  const handleRemindSigner = async (signerEmail) => {
    setNotification({ message: `Sending reminder to ${signerEmail}... (Simulated)`, type: "info" });
    setTimeout(() => {
      setNotification({ message: `Reminder sent to ${signerEmail}!`, type: "success" });
    }, 1500);
  };

  /**
   * Navigates to the document details page for a specific signature request.
   * @param {Object} request - The signature request object.
   */
  const handleViewSignatureRequestDetails = (request) => {
    const docId = request.document_id || (request.documents && request.documents.id) || request.id;
    navigate(`/user/documents/${docId}`);
  };

  // Display loading indicator while data is being fetched
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
        <p className="text-xl">Loading signature requests...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 animate-fade-in-up min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
      {/* Display notifications */}
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      {/* Page Header */}
      <header className="mb-8 border-b border-brand-border-light pb-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-brand-heading">Signature Requests</h1>
        <p className="text-brand-text-light mt-2">Manage all incoming and outgoing document signature requests.</p>
      </header>

      {/* Tab Navigation (Sent by me / Requested from me) */}
      <section className="mb-6">
        <div className="flex border-b border-brand-border-light">
          <button
            className={`px-6 py-3 text-lg font-medium transition-colors duration-200
              ${activeTab === "sent" ? "border-b-2 border-color-button-primary text-color-button-primary" : "text-brand-text-light hover:text-brand-heading"}`}
            onClick={() => setActiveTab("sent")}
          >
            Sent by me
          </button>
          <button
            className={`px-6 py-3 text-lg font-medium transition-colors duration-200
              ${activeTab === "received" ? "border-b-2 border-color-button-primary text-color-button-primary" : "text-brand-text-light hover:text-brand-heading"}`}
            onClick={() => setActiveTab("received")}
          >
            Requested from me
          </button>
        </div>
      </section>

      {/* Search and Filter Controls */}
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
          {["all", "pending", "signed", "declined", "cancelled", "expired", "void"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-md capitalize text-sm font-medium transition-colors duration-200
                ${
                  filterStatus === status ? "bg-color-button-primary text-white hover:bg-color-button-primary-hover" : "bg-brand-card text-brand-text border border-brand-border hover:bg-brand-bg-dark"
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      {/* Display Signature Requests or No Requests Message */}
      {signatureRequests.length === 0 && !loading ? (
        <div className="bg-brand-card p-6 rounded-lg shadow-card text-center text-brand-text-light">
          <p className="text-lg">No signature requests found in the '{activeTab}' tab matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {signatureRequests.map((request) => {
            return (
              <div key={request.id} className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border flex flex-col justify-between animate-fade-in-up">
                <div>
                  <h3 className="text-xl font-semibold text-brand-heading mb-2">{request.document_title}</h3>
                  <p className="text-brand-text-light mb-4 text-sm">
                    {activeTab === "sent" ? (
                      <>
                        <span className="font-medium">To:</span> {request.signer_email}
                      </>
                    ) : (
                      <>
                        <span className="font-medium">From:</span> {request.document_owner_id === currentUser?.id ? "Me" : "Document Owner"}
                      </>
                    )}
                  </p>
                  <p className="text-brand-text text-sm">
                    <span className="font-medium">Date Sent:</span> {new Date(request.requested_at).toLocaleDateString()}
                  </p>
                  {request.status === "signed" && request.signed_at && (
                    <p className="text-brand-text text-sm">
                      <span className="font-medium">Signed:</span> {new Date(request.signed_at).toLocaleDateString()}
                    </p>
                  )}
                  {request.status === "declined" && request.declined_at && (
                    <p className="text-brand-text text-sm">
                      <span className="font-medium">Declined:</span> {new Date(request.declined_at).toLocaleDateString()}
                    </p>
                  )}
                  {request.status === "cancelled" && request.cancelled_at && (
                    <p className="text-brand-text text-sm">
                      <span className="font-medium">Cancelled:</span> {new Date(request.cancelled_at).toLocaleDateString()}
                    </p>
                  )}
                  {request.status === "void" && request.voided_at && (
                    <p className="text-brand-text text-sm">
                      <span className="font-medium">Voided:</span> {new Date(request.voided_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold self-start ${getStatusClasses(request.status)}`}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    {request.document_version_number > 0 && ` (v${request.document_version_number})`}
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* Actions for 'Received' requests */}
                    {activeTab === "received" && request.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleAction(request.id, request.document_id, request.document_version_id, "sign")}
                          className="flex-1 px-4 py-2 bg-color-button-primary text-white rounded-md hover:bg-color-button-primary-hover transition-colors duration-200 text-sm z-10 pointer-events-auto cursor-pointer"
                          disabled={loading}
                        >
                          Sign Document
                        </button>
                        <button
                          onClick={() => handleAction(request.id, request.document_id, request.document_version_id, "reject")}
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
                          onClick={() => handleAction(request.id, request.document_id, request.document_version_id, "cancel")}
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

      {/* Pagination Controls */}
      {totalRequestsCount > 0 && (
        <div className="flex justify-center items-center mt-8 space-x-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || loading}
            className="px-4 py-2 bg-color-button-primary text-white rounded-md hover:bg-color-button-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Previous
          </button>
          <span className="text-lg font-medium text-brand-text">
            Page {currentPage} of {Math.ceil(totalRequestsCount / itemsPerPage)}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => prev + 1)}
            disabled={currentPage * itemsPerPage >= totalRequestsCount || loading}
            className="px-4 py-2 bg-color-button-primary text-white rounded-md hover:bg-color-button-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default SignatureRequestsListPage;
