import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import Modal from "../components/Modal";

const AnomaliesPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Filter & Search states
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState(""); // Search by reported_by_email, reason, details
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalReportsCount, setTotalReportsCount] = useState(0);

  // Modal states for viewing/editing report details
  const [showReportModal, setShowReportModal] = useState(false);
  const [modalReportContent, setModalReportContent] = useState({}); // Object to store report details for modal
  const [newReportStatus, setNewReportStatus] = useState(""); // State for status update in modal
  const [newReportDetails, setNewReportDetails] = useState(""); // State for updated details in modal

  const reportStatusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "resolved", label: "Resolved" },
  ];

  /**
   * Helper function to format timestamps.
   */
  const formatTimestamp = (isoString) => {
    if (!isoString) return "N/A";
    const date = new Date(isoString);
    const options = {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };
    return date.toLocaleDateString("en-US", options);
  };

  /**
   * Fetches incident reports from Supabase with filters and pagination.
   */
  const fetchReports = useCallback(async () => {
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

    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase.from("incident_reports").select(
        `
          id,
          timestamp,
          reported_by_user_id,
          reported_by_email,
          document_id,
          reason,
          details,
          status,
          resolved_by_user_id,
          resolved_at,
          reporter:users!fk_incident_reports_reported_by_user_id(full_name),
          resolver:users!fk_incident_reports_resolved_by_user_id(full_name),
          documents!fk_incident_reports_document_id(title)
        `,
        { count: "exact" }
      );

      // Apply filters
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }
      if (startDate) {
        query = query.gte("timestamp", new Date(startDate).toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("timestamp", endOfDay.toISOString());
      }

      // Apply search term for reported_by_email, reason, or details
      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        query = query.or(`reported_by_email.ilike.${searchPattern},reason.ilike.${searchPattern},details.ilike.${searchPattern}`);
      }

      // Order by timestamp descending (most recent reports first)
      query = query.order("timestamp", { ascending: false });
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error("Supabase fetch incident reports error:", error);
        setNotification({
          message: `Failed to fetch incident reports: ${error.message}`,
          type: "error",
        });
        setReports([]);
        setTotalReportsCount(0);
      } else {
        setTotalReportsCount(count);
        setReports(data);
      }
    } catch (err) {
      console.error("Unexpected error during report fetch:", err);
      setNotification({
        message: err.message || "An unexpected error occurred while fetching reports.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filterStatus, searchTerm, startDate, endDate]);

  // Effect to reset page to 1 when filters or search term change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchTerm, startDate, endDate]);

  // Effect to fetch data when currentPage or other fetch dependencies change
  useEffect(() => {
    fetchReports();
  }, [currentPage, fetchReports]); // Depend on currentPage and the memoized callback

  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalReportsCount / itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  /**
   * Prepares and shows the report details modal.
   * @param {object} report - The report object to display in the modal.
   */
  const handleViewReport = (report) => {
    setModalReportContent(report);
    setNewReportStatus(report.status); // Set initial status for editing
    setNewReportDetails(report.details || ""); // Set initial details
    setShowReportModal(true);
  };

  /**
   * Updates the status and details of an incident report.
   */
  const handleUpdateReport = async () => {
    setLoading(true);
    setNotification({ message: "", type: "" });

    // Get current authenticated user's ID for resolved_by_user_id
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setNotification({ message: authError?.message || "User not authenticated.", type: "error" });
      setLoading(false);
      return;
    }

    try {
      const updateData = {
        status: newReportStatus,
        details: newReportDetails, // Allow updating details/resolution notes
      };

      // If status is changed to 'resolved', set resolved_by and resolved_at
      if (newReportStatus === "resolved" && modalReportContent.status !== "resolved") {
        updateData.resolved_by_user_id = user.id;
        updateData.resolved_at = new Date().toISOString();
      } else if (newReportStatus !== "resolved" && modalReportContent.status === "resolved") {
        // If changing from resolved to something else, clear resolved fields
        updateData.resolved_by_user_id = null;
        updateData.resolved_at = null;
      }

      const { data, error } = await supabase.from("incident_reports").update(updateData).eq("id", modalReportContent.id);

      if (error) {
        setNotification({
          message: `Failed to update report: ${error.message}`,
          type: "error",
        });
      } else {
        setNotification({
          message: "Report updated successfully!",
          type: "success",
        });
        setShowReportModal(false); // Close modal on success
        fetchReports(); // Refresh the list
      }
    } catch (err) {
      setNotification({
        message: err.message || "An unexpected error occurred during update.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
        <p className="text-xl">Loading incident reports...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      <header className="mb-8 border-b border-brand-border-light pb-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-brand-heading">Anomalies & Incident Reports</h1>
        <p className="text-brand-text-light mt-2">Review and manage reported issues within the system.</p>
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
            placeholder="Email, reason, details..."
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text placeholder-brand-text-light focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="filterStatus" className="block text-sm font-medium text-brand-text mb-1">
            Status
          </label>
          <select
            id="filterStatus"
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            {reportStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col md:flex-row gap-4 lg:col-span-2">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-brand-text mb-1">
              Reported From
            </label>
            <input
              type="date"
              id="startDate"
              className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-brand-text mb-1">
              Reported To
            </label>
            <input
              type="date"
              id="endDate"
              className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Reports Table */}
      {reports.length === 0 && !loading ? (
        <div className="bg-brand-card p-6 rounded-lg shadow-card text-center text-brand-text-light">
          <p className="text-lg">No incident reports found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-brand-card rounded-lg shadow-card border border-brand-border">
            <table className="min-w-full divide-y divide-brand-border">
              <thead className="bg-brand-bg-dark">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Reported By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-brand-card divide-y divide-brand-border">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-brand-bg-dark transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{formatTimestamp(report.timestamp)}</td>
                    {/* Access nested data using the new aliases */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{report.reporter?.full_name || report.reported_by_email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{report["documents!fk_incident_reports_document_id"]?.title || "N/A"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{report.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          report.status === "pending" ? "bg-yellow-100 text-yellow-800" : report.status === "resolved" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {report.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleViewReport(report)} className="text-color-button-primary hover:text-color-button-primary-hover transition-colors duration-200">
                        View / Resolve
                      </button>
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

      {/* Report Details Modal */}
      <Modal show={showReportModal} onClose={() => setShowReportModal(false)}>
        <h2 className="text-xl font-semibold mb-4 text-brand-heading">Incident Report Details</h2>
        <div className="space-y-4 text-brand-text-light">
          <p>
            <strong>Report ID:</strong> {modalReportContent.id}
          </p>
          <p>
            <strong>Timestamp:</strong> {formatTimestamp(modalReportContent.timestamp)}
          </p>
          <p>
            <strong>Reported By:</strong> {modalReportContent.reporter?.full_name || modalReportContent.reported_by_email}
          </p>
          <p>
            <strong>Associated Document:</strong> {modalReportContent["documents!fk_incident_reports_document_id"]?.title || "N/A"}
          </p>
          <p>
            <strong>Reason:</strong> {modalReportContent.reason}
          </p>
          <div>
            <label htmlFor="modalDetails" className="block text-sm font-medium text-brand-text mb-1">
              Details:
            </label>
            <textarea
              id="modalDetails"
              className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text placeholder-brand-text-light focus:outline-none focus:ring-2 focus:ring-color-button-primary h-32"
              value={newReportDetails}
              onChange={(e) => setNewReportDetails(e.target.value)}
              placeholder="Add resolution notes or further details here..."
            ></textarea>
          </div>
          <p>
            <strong>Current Status:</strong>{" "}
            <span
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                modalReportContent.status === "pending" ? "bg-yellow-100 text-yellow-800" : modalReportContent.status === "resolved" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              }`}
            >
              {modalReportContent.status?.toUpperCase()}
            </span>
          </p>

          <div>
            <label htmlFor="newStatus" className="block text-sm font-medium text-brand-text mb-1">
              Update Status:
            </label>
            <select
              id="newStatus"
              className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
              value={newReportStatus}
              onChange={(e) => setNewReportStatus(e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {(modalReportContent.resolved_by_user_id || modalReportContent.resolved_at) && (
            <p>
              <strong>Resolved By:</strong> {modalReportContent.resolver?.full_name || "N/A"} at {formatTimestamp(modalReportContent.resolved_at)}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowReportModal(false)} className="px-4 py-2 border border-brand-border-light text-brand-text rounded-md hover:bg-brand-bg-dark transition-colors duration-200">
              Cancel
            </button>
            <button onClick={handleUpdateReport} className="px-4 py-2 bg-color-button-primary text-white rounded-md hover:bg-color-button-primary-hover transition-colors duration-200">
              Update Report
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AnomaliesPage;
