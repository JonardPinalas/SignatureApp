import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import AdminRecordEditModal from "../components/AdminRecordEditModal";

const ADMIN_TABLES = [
  { name: "users", display: "Users", orderColumn: "created_at" },
  { name: "documents", display: "Documents", orderColumn: "created_at" },
  { name: "document_versions", display: "Document Versions", orderColumn: "created_at" },
  { name: "signature_requests", display: "Signature Requests", orderColumn: "requested_at" }, // Changed
  { name: "incident_reports", display: "Incident Reports", orderColumn: "timestamp" }, // Changed
  // 'audit_logs' intentionally excluded for direct editing
];

// Helper function to format timestamp
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

// Helper to render table cells based on data type (can be expanded)
const renderTableCell = (key, value) => {
  if (key.includes("timestamp") || key.includes("at")) {
    return formatTimestamp(value);
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (value === null || value === undefined) {
    return "N/A";
  }
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value); // For JSONB or complex objects
  }
  return String(value);
};

const AdminRecordEdit = () => {
  const [selectedTable, setSelectedTable] = useState(ADMIN_TABLES[0].name);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalRecordsCount, setTotalRecordsCount] = useState(0);

  // Modal states for editing a record
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null); // The record being edited

  // Fetch schema (column names) for the selected table dynamically
  const [tableColumns, setTableColumns] = useState([]);

  const fetchRecords = useCallback(async () => {
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

      // Determine the correct order column for the selected table
      const currentTableConfig = ADMIN_TABLES.find((t) => t.name === selectedTable);
      const orderColumn = currentTableConfig?.orderColumn || "id"; // Fallback to 'id' if no specific column is defined

      const { data, error, count } = await supabase
        .from(selectedTable)
        .select("*", { count: "exact" }) // Select all columns and get exact count
        .order(orderColumn, { ascending: false }) // Use the dynamic orderColumn
        .range(from, to);

      if (error) {
        console.error(`Supabase fetch ${selectedTable} records error:`, error);
        setNotification({
          message: `Failed to fetch ${selectedTable} records: ${error.message}`,
          type: "error",
        });
        setRecords([]);
        setTotalRecordsCount(0);
      } else {
        setTotalRecordsCount(count);
        setRecords(data);
        if (data.length > 0) {
          // Dynamically determine columns from the first record
          const columns = Object.keys(data[0]);
          setTableColumns(columns);
        } else {
          setTableColumns([]);
        }
      }
    } catch (err) {
      console.error("Unexpected error during record fetch:", err);
      setNotification({
        message: err.message || "An unexpected error occurred while fetching records.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTable, currentPage, itemsPerPage]);

  useEffect(() => {
    // Reset page to 1 whenever the selected table changes
    setCurrentPage(1);
    fetchRecords();
  }, [selectedTable, fetchRecords]); // Add fetchRecords to dependency array

  const totalPages = Math.ceil(totalRecordsCount / itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleEditClick = (record) => {
    setCurrentRecord(record);
    setShowEditModal(true);
  };

  const handleModalClose = () => {
    setShowEditModal(false);
    setCurrentRecord(null); // Clear the current record
  };

  const handleSaveSuccess = (updatedRecord) => {
    // Refresh the list after a successful save or delete
    fetchRecords();
  };

  // Basic authorization check (can be expanded with RLS)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const checkAdminRole = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setIsAdmin(false);
        return;
      }
      const { data: userData, error: userError } = await supabase.from("users").select("role").eq("id", data.user.id).single();

      if (userError || !userData || userData.role !== "admin") {
        // Assuming 'admin' is the role for master access
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
      }
    };
    checkAdminRole();
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-red-500">
        <p className="text-xl">Access Denied. You do not have administrative privileges.</p>
      </div>
    );
  }

  if (loading && records.length === 0) {
    // Only show full loading if no data fetched yet
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
        <p className="text-xl">Loading records...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen-minus-navbar bg-brand-bg-light text-brand-text flex">
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      {/* Sidebar for Table Selection */}
      <aside className="w-64 bg-brand-card p-6 rounded-lg shadow-card mr-8 flex-shrink-0">
        <h2 className="text-2xl font-semibold mb-6 text-brand-heading">Manage Data</h2>
        <nav>
          <ul>
            {ADMIN_TABLES.map((table) => (
              <li key={table.name} className="mb-2">
                <button
                  onClick={() => setSelectedTable(table.name)}
                  className={`w-full text-left py-2 px-4 rounded-md transition-colors duration-200 ${
                    selectedTable === table.name ? "bg-color-button-primary text-white" : "bg-brand-bg-light hover:bg-brand-bg-dark text-brand-text"
                  }`}
                >
                  {table.display}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area - Table Display */}
      <main className="flex-grow">
        <header className="mb-6 border-b border-brand-border-light pb-4">
          <h1 className="text-3xl md:text-4xl font-semibold text-brand-heading">{ADMIN_TABLES.find((t) => t.name === selectedTable)?.display} Records</h1>
          <p className="text-brand-text-light mt-2">View and manage data for the selected table.</p>
        </header>

        {loading && records.length === 0 ? (
          <div className="flex justify-center items-center py-10">
            <p className="text-xl">Loading data...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="bg-brand-card p-6 rounded-lg shadow-card text-center text-brand-text-light">
            <p className="text-lg">No records found for {selectedTable}.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto bg-brand-card rounded-lg shadow-card border border-brand-border">
              <table className="min-w-full divide-y divide-brand-border">
                <thead className="bg-brand-bg-dark">
                  <tr>
                    {tableColumns.map((col) => (
                      <th key={col} className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">
                        {col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-brand-card divide-y divide-brand-border">
                  {records.map((record) => (
                    <tr key={record.id || JSON.stringify(record)} className="hover:bg-brand-bg-dark transition-colors duration-150">
                      {tableColumns.map((col) => (
                        <td key={`${record.id}-${col}`} className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
                          {renderTableCell(col, record[col])}
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditClick(record)} className="text-color-button-primary hover:text-color-button-primary-hover transition-colors duration-200 mr-4">
                          Edit
                        </button>
                        {/* Delete action will be handled within the modal for confirmation */}
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
                  disabled={currentPage === 1 || loading}
                  className="px-4 py-2 bg-color-button-primary text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-color-button-primary-hover transition-colors duration-200"
                >
                  Previous
                </button>
                <span className="text-brand-text">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="px-4 py-2 bg-color-button-primary text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-color-button-primary-hover transition-colors duration-200"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* AdminRecordEditModal for editing a single record */}
      <AdminRecordEditModal show={showEditModal} onClose={handleModalClose} tableName={selectedTable} record={currentRecord} onSaveSuccess={handleSaveSuccess} />
    </div>
  );
};

export default AdminRecordEdit;
