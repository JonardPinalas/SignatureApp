import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import Modal from "../components/Modal";

const ManageUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Filter & Search states
  const [filterRole, setFilterRole] = useState("all");
  const [filterVerificationStatus, setFilterVerificationStatus] = useState("all"); // 'all', 'true', 'false'
  const [searchTerm, setSearchTerm] = useState(""); // Search by full_name, email
  const [startDate, setStartDate] = useState(""); // Filter by created_at
  const [endDate, setEndDate] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalUsersCount, setTotalUsersCount] = useState(0);

  // Filter options for dropdowns
  const [rolesList, setRolesList] = useState([]);
  const verificationStatusOptions = [
    { value: "all", label: "All" },
    { value: "true", label: "Verified" },
    { value: "false", label: "Unverified" },
  ];

  // Modal states for viewing user details
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalUserContent, setModalUserContent] = useState({}); // Object to store user details for modal

  /**
   * Helper function to format timestamps.
   */
  const formatTimestamp = (isoString) => {
    if (!isoString) return "N/A";
    const date = new Date(isoString);
    const options = {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds}`;
  };

  /**
   * Fetches users from Supabase with filters and pagination.
   */
  const fetchUsers = useCallback(async () => {
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

    // IMPORTANT: Ensure RLS is set up in Supabase to only allow admins to read this data.
    // This client-side check is for user experience, but RLS is the security gate.
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

      let query = supabase.from("users").select(
        `
          id,
          email,
          full_name,
          title,
          department,
          role,
          is_verified,
          created_at,
          updated_at
        `,
        { count: "exact" }
      );

      // Apply filters
      if (filterRole !== "all") {
        query = query.eq("role", filterRole);
      }
      if (filterVerificationStatus !== "all") {
        query = query.eq("is_verified", filterVerificationStatus === "true");
      }
      if (startDate) {
        query = query.gte("created_at", new Date(startDate).toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      // Apply search term for full_name or email
      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        query = query.or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`);
      }

      // Order by created_at descending (most recent users first)
      query = query.order("created_at", { ascending: false });
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error("Supabase fetch users error:", error);
        setNotification({
          message: `Failed to fetch users: ${error.message}`,
          type: "error",
        });
        setUsers([]);
        setTotalUsersCount(0);
      } else {
        setTotalUsersCount(count);
        setUsers(data);
      }
    } catch (err) {
      console.error("Unexpected error during user fetch:", err);
      setNotification({
        message: err.message || "An unexpected error occurred while fetching users.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filterRole, filterVerificationStatus, searchTerm, startDate, endDate]);

  /**
   * Fetches distinct roles from the users table for filter dropdown.
   */
  useEffect(() => {
    const fetchFilterOptions = async () => {
      // Fetch distinct roles
      const { data: rolesData, error: rolesError } = await supabase.from("users").select("role").distinct("role").order("role", { ascending: true });

      if (rolesError) {
        console.error("Error fetching distinct roles for filter:", rolesError);
      } else {
        setRolesList(rolesData.map((r) => r.role));
      }
    };

    fetchFilterOptions();
  }, []); // Run once on mount

  // Effect to reset page to 1 when filters or search term change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterRole, filterVerificationStatus, searchTerm, startDate, endDate]);

  // Effect to fetch data when currentPage or other fetch dependencies change
  useEffect(() => {
    fetchUsers();
  }, [currentPage, fetchUsers]); // Depend on currentPage and the memoized callback

  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalUsersCount / itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  /**
   * Prepares and shows the user details modal.
   * @param {object} user - The user object to display in the modal.
   */
  const handleViewUser = (user) => {
    // Exclude sensitive data like password_hash if it were fetched
    const displayUser = { ...user };
    delete displayUser.password_hash; // Ensure sensitive data is not passed

    setModalUserContent(displayUser);
    setShowUserModal(true);
  };

  /**
   * Helper to format user details for the modal.
   */
  const formatUserDetailsForModal = (user) => {
    if (!user) return "No user data available.";
    return `
ID: ${user.id}
Email: ${user.email}
Full Name: ${user.full_name || "N/A"}
Role: ${String(user.role).toUpperCase()}
Verified: ${user.is_verified ? "Yes" : "No"}
Title: ${user.title || "N/A"}
Department: ${user.department || "N/A"}
Created At: ${formatTimestamp(user.created_at)}
Last Updated: ${formatTimestamp(user.updated_at)}
    `.trim();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
        <p className="text-xl">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      <header className="mb-8 border-b border-brand-border-light pb-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-brand-heading">Manage Users</h1>
        <p className="text-brand-text-light mt-2">View and manage all registered users in the system.</p>
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
            placeholder="Name, email..."
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text placeholder-brand-text-light focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="filterRole" className="block text-sm font-medium text-brand-text mb-1">
            Role
          </label>
          <select
            id="filterRole"
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            {rolesList.map((role) => (
              <option key={role} value={role}>
                {role
                  .replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filterVerificationStatus" className="block text-sm font-medium text-brand-text mb-1">
            Verification Status
          </label>
          <select
            id="filterVerificationStatus"
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={filterVerificationStatus}
            onChange={(e) => setFilterVerificationStatus(e.target.value)}
          >
            {verificationStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col md:flex-row gap-4 lg:col-span-1">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-brand-text mb-1">
              Created From
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
              Created To
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

      {/* Users Table */}
      {users.length === 0 && !loading ? (
        <div className="bg-brand-card p-6 rounded-lg shadow-card text-center text-brand-text-light">
          <p className="text-lg">No users found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-brand-card rounded-lg shadow-card border border-brand-border">
            <table className="min-w-full divide-y divide-brand-border">
              <thead className="bg-brand-bg-dark">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Full Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Verified</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Created At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-brand-card divide-y divide-brand-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-brand-bg-dark transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-text">{user.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === "admin" ? "bg-purple-100 text-purple-800" : user.role === "user" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {user.role.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_verified ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {user.is_verified ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{formatTimestamp(user.created_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{formatTimestamp(user.updated_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleViewUser(user)} className="text-color-button-primary hover:text-color-button-primary-hover transition-colors duration-200">
                        View Details
                      </button>
                      {/* Add more admin actions here, e.g., Edit Role, Delete User */}
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

      {/* User Details Modal */}
      <Modal show={showUserModal} onClose={() => setShowUserModal(false)}>
        <h2 className="text-xl font-semibold mb-4 text-brand-heading">User Details</h2>
        <pre className="whitespace-pre-wrap text-brand-text-light text-sm bg-brand-bg-dark p-4 rounded-md">{formatUserDetailsForModal(modalUserContent)}</pre>
      </Modal>
    </div>
  );
};

export default ManageUsersPage;
