import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import Modal from "../components/Modal";

const ManageAuditLogsPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Filter states
  const [filterEventType, setFilterEventType] = useState("all");
  const [filterUserId, setFilterUserId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // More items per page for admin view
  const [totalLogsCount, setTotalLogsCount] = useState(0);

  // State to hold a list of all distinct users for the filter dropdown
  const [usersList, setUsersList] = useState([]);
  const [eventTypesList, setEventTypesList] = useState([]);

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalDetailsContent, setModalDetailsContent] = useState("");
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [modalDocumentContent, setModalDocumentContent] = useState("");

  /**
   * Helper function to format timestamps without date-fns.
   */
  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    const options = {
      month: "short", // e.g., "May"
      day: "2-digit", // e.g., "01"
      year: "numeric", // e.g., "2023"
      hour: "2-digit", // e.g., "00"
      minute: "2-digit", // e.g., "00"
      second: "2-digit", // e.g., "00"
      hour12: false, // Use 24-hour format
    };
    return date.toLocaleDateString(undefined, options) + " " + date.toLocaleTimeString(undefined, options);
  };

  /**
   * Fetches audit logs from Supabase with filters and pagination.
   * Memoized using useCallback.
   */
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setNotification({ message: "", type: "" });

    if (!supabase) {
      setNotification({
        message: "Supabase client not available. Please check configuration.",
        type: "error",
      });
      setLoading(false);
      return;
    }

    // Check if the current user is an admin (important for RLS)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setNotification({ message: userError?.message || "User not authenticated.", type: "error" });
      setLoading(false);
      return;
    }

    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase.from("audit_logs").select(
        `
          id,
          timestamp,
          user_id,
          user_email,
          event_type,
          details,
          ip_address,
          document_id,
          document_version_id,
          signature_request_id,
          users (full_name),
          documents (title),
          document_versions (version_number, file_name)
        `,
        { count: "exact" }
      );

      // Apply filters
      if (filterEventType !== "all") {
        query = query.eq("event_type", filterEventType);
      }
      if (filterUserId !== "all") {
        query = query.eq("user_id", filterUserId);
      }
      if (startDate) {
        query = query.gte("timestamp", new Date(startDate).toISOString());
      }
      if (endDate) {
        // To include the whole day, set the end of the day
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("timestamp", endOfDay.toISOString());
      }

      // Apply search term for event type or user email (details is JSONB and cannot be searched with ilike)
      if (searchTerm) {
        query = query.or(`event_type.ilike.%${searchTerm}%,user_email.ilike.%${searchTerm}%`);
      }

      // Order by timestamp descending (most recent first)
      query = query.order("timestamp", { ascending: false });

      // Apply pagination
      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error("Supabase fetch audit logs error:", error);
        setNotification({
          message: `Failed to fetch audit logs: ${error.message}`,
          type: "error",
        });
        setAuditLogs([]);
        setTotalLogsCount(0);
      } else {
        setTotalLogsCount(count);
        setAuditLogs(data);
      }
    } catch (err) {
      console.error("Unexpected error during audit log fetch:", err);
      setNotification({
        message: err.message || "An unexpected error occurred while fetching audit logs.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filterEventType, filterUserId, searchTerm, startDate, endDate]); // Dependencies remain the same

  /**
   * Fetches distinct users and event types for filter dropdowns.
   * This should only run once on component mount.
   */
  useEffect(() => {
    const fetchFilterOptions = async () => {
      // Fetch distinct users who have logged events
      const { data: usersData, error: usersError } = await supabase
        .from("audit_logs")
        .select("user_id, user_email, users!audit_logs_user_id_fkey(full_name)")
        .not("user_id", "is", null) // Only get logs with a user_id
        .distinct("user_id")
        .order("user_email", { ascending: true }); // Order for consistent display

      if (usersError) {
        console.error("Error fetching distinct users for filter:", usersError);
      } else {
        const uniqueUsers = usersData.map((log) => ({
          id: log.user_id,
          email: log.user_email,
          fullName: log.users?.full_name || log.user_email, // Fallback to email if full_name is null
        }));
        setUsersList(uniqueUsers);
      }

      // Fetch distinct event types
      const { data: eventTypesData, error: eventTypesError } = await supabase.from("audit_logs").select("event_type").distinct("event_type").order("event_type", { ascending: true });

      if (eventTypesError) {
        console.error("Error fetching distinct event types for filter:", eventTypesError);
      } else {
        setEventTypesList(eventTypesData.map((d) => d.event_type));
      }
    };

    fetchFilterOptions();
  }, []); // Empty dependency array means this runs once on mount

  // Effect to reset page to 1 when filters or search term change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterEventType, filterUserId, searchTerm, startDate, endDate]);

  // Effect to fetch data when currentPage or other fetch dependencies change
  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage, fetchAuditLogs]); // Depend on currentPage and the memoized callback

  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalLogsCount / itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  /**
   * Enhances readability of the 'details' JSON object.
   * @param {object | string} details - The details field from the audit log.
   * @returns {string} - A human-readable string representation of the details.
   */
  const getDetailsDisplay = (details) => {
    if (!details) return "N/A";

    let parsedDetails;
    try {
      parsedDetails = typeof details === "string" ? JSON.parse(details) : details;
    } catch (e) {
      return String(details);
    }

    if (typeof parsedDetails !== "object" || parsedDetails === null) {
      return String(parsedDetails);
    }

    const parts = [];

    if (parsedDetails.status) {
      parts.push(`Status: ${String(parsedDetails.status).toUpperCase()}`);
    }
    if (parsedDetails.reason) {
      parts.push(`Reason: ${parsedDetails.reason}`);
    }
    if (parsedDetails.changes) {
      parts.push(`Changes: ${JSON.stringify(parsedDetails.changes)}`);
    }

    if (parsedDetails.location && typeof parsedDetails.location === "object") {
      const loc = parsedDetails.location;
      let locationParts = [];
      if (loc.city) locationParts.push(loc.city);
      if (loc.region && loc.city !== loc.region) locationParts.push(loc.region);
      if (loc.country) locationParts.push(loc.country);
      if (locationParts.length > 0) {
        parts.push(`Location: ${locationParts.join(", ")}`);
      }
    }

    if (parsedDetails.userAgent) {
      parts.push(`User Agent: ${parsedDetails.userAgent}`); // Full user agent for modal
    }

    for (const key in parsedDetails) {
      if (Object.prototype.hasOwnProperty.call(parsedDetails, key) && !["status", "reason", "changes", "location", "userAgent"].includes(key)) {
        const value = parsedDetails[key];
        parts.push(`${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
      }
    }

    return parts.length > 0 ? parts.join("\n") : JSON.stringify(parsedDetails, null, 2);
  };

  // Function to prepare and show the details modal
  const handleShowDetails = (details) => {
    setModalDetailsContent(getDetailsDisplay(details));
    setShowDetailsModal(true);
  };

  // Function to prepare and show the document modal
  const handleShowDocumentDetails = (log) => {
    let docContent = "No related document information available.";
    if (log.documents?.title || log.document_id || log.document_versions?.version_number || log.signature_request_id) {
      docContent = `
            ${log.documents?.title ? `Document Title: ${log.documents.title}\n` : ""}
            ${log.document_id ? `Document ID: ${log.document_id}\n` : ""}
            ${log.document_versions?.version_number ? `Version: ${log.document_versions.version_number}\n` : ""}
            ${log.document_versions?.file_name ? `File Name: ${log.document_versions.file_name}\n` : ""}
            ${log.signature_request_id ? `Signature Request ID: ${log.signature_request_id}\n` : ""}
        `.trim();
    }
    setModalDocumentContent(docContent);
    setShowDocumentModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
        <p className="text-xl">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 animate-fade-in-up min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      <header className="mb-8 border-b border-brand-border-light pb-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-brand-heading">Audit Logs</h1>
        <p className="text-brand-text-light mt-2">Review all system activities and user actions.</p>
      </header>

      {/* Search and Filter Controls */}
      <section className="bg-brand-card p-6 rounded-lg shadow-card mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="searchTerm" className="block text-sm font-medium text-brand-text mb-1">
            Search
          </label>
          <input
            type="text"
            id="searchTerm"
            placeholder="Event, user, details..."
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text placeholder-brand-text-light focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="filterEventType" className="block text-sm font-medium text-brand-text mb-1">
            Event Type
          </label>
          <select
            id="filterEventType"
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
          >
            <option value="all">All Event Types</option>
            {eventTypesList.map((type) => (
              <option key={type} value={type}>
                {type
                  .replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filterUserId" className="block text-sm font-medium text-brand-text mb-1">
            User
          </label>
          <select
            id="filterUserId"
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
          >
            <option value="all">All Users</option>
            {usersList.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} ({user.email})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col md:flex-row gap-4 lg:col-span-1">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-brand-text mb-1">
              From Date
            </label>
            <input
              type="date"
              id="startDate"
              className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-button-primary"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-brand-text mb-1">
              To Date
            </label>
            <input
              type="date"
              id="endDate"
              className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-button-primary"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Audit Log Table */}
      {auditLogs.length === 0 && !loading ? (
        <div className="bg-brand-card p-6 rounded-lg shadow-card text-center text-brand-text-light">
          <p className="text-lg">No audit logs found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-brand-card rounded-lg shadow-card border border-brand-border">
            <table className="min-w-full divide-y divide-brand-border">
              <thead className="bg-brand-bg-dark">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Event Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Related Document</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-brand-card divide-y divide-brand-border">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-brand-bg-dark transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{formatTimestamp(log.timestamp)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{log.users?.full_name || log.user_email || "System"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-button-primary">{log.event_type.replace(/_/g, " ").toUpperCase()}</td>
                    {/* Related Document Button */}
                    <td className="px-6 py-4 text-sm text-brand-text">
                      {log.documents?.title || log.document_id || log.document_versions?.version_number || log.signature_request_id ? (
                        <button
                          onClick={() => handleShowDocumentDetails(log)}
                          className="px-3 py-1 bg-color-button-secondary text-white rounded-md text-xs hover:bg-color-button-secondary-hover transition-colors duration-200"
                        >
                          View Document
                        </button>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{log.ip_address || "N/A"}</td>
                    {/* Details Button */}
                    <td className="px-6 py-4 text-sm text-brand-text">
                      {log.details ? (
                        <button
                          onClick={() => handleShowDetails(log.details)}
                          className="px-3 py-1 bg-color-button-secondary text-white rounded-md text-xs hover:bg-color-button-secondary-hover transition-colors duration-200"
                        >
                          View Details
                        </button>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-6 space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-color-button-primary text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-color-button-primary-hover transition-colors duration-200"
              >
                Previous
              </button>
              <span className="text-brand-text">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-color-button-primary text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-color-button-primary-hover transition-colors duration-200"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Details Modal */}
      <Modal show={showDetailsModal} onClose={() => setShowDetailsModal(false)}>
        <h2 className="text-xl font-semibold mb-4 text-brand-heading">Audit Log Details</h2>
        <div className="flex flex-wrap gap-2 bg-brand-bg-dark p-4 rounded-md">
          {(() => {
            let parsed;
            try {
              parsed = typeof modalDetailsContent === "string" ? JSON.parse(modalDetailsContent) : modalDetailsContent;
            } catch {
              parsed = null;
            }
            if (parsed && typeof parsed === "object") {
              return Object.entries(parsed).map(([key, value]) => (
                <button
                  key={key}
                  className="px-3 py-1 bg-color-button-secondary text-white rounded-md text-xs hover:bg-color-button-secondary-hover transition-colors duration-200"
                  title={typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                >
                  {key}
                </button>
              ));
            }
            return <pre className="whitespace-pre-wrap text-brand-text-light text-sm">{modalDetailsContent}</pre>;
          })()}
        </div>
      </Modal>

      {/* Related Document Modal */}
      <Modal show={showDocumentModal} onClose={() => setShowDocumentModal(false)}>
        <h2 className="text-xl font-semibold mb-4 text-brand-heading">Related Document Information</h2>
        <pre className="whitespace-pre-wrap text-brand-text-light text-sm bg-brand-bg-dark p-4 rounded-md">{modalDocumentContent}</pre>
      </Modal>
    </div>
  );
};

export default ManageAuditLogsPage;
