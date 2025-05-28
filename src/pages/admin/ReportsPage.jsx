import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import Modal from "../components/Modal";
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'; // Example Recharts imports if you use it

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [reportData, setReportData] = useState({
    documentStatus: [],
    signatureStatus: [],
    userRoles: [],
    incidentStatus: [],
    totalDocuments: 0,
    totalSignatureRequests: 0,
    totalUsers: 0,
    totalIncidentReports: 0,
    averageSigningTime: "N/A",
    recentAuditLogs: [],
    // Add more data points for trends/charts
  });

  // Date range filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
    return date.toLocaleDateString("en-US", options);
  };

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
      // Helper for conditional date filtering for direct queries
      const applyDateFilterToQuery = (query, timestampColumn, start, end) => {
        let newQuery = query;
        if (start) {
          newQuery = newQuery.gte(timestampColumn, new Date(start).toISOString());
        }
        if (end) {
          const endOfDay = new Date(end);
          endOfDay.setHours(23, 59, 59, 999); // Set to end of day
          newQuery = newQuery.lte(timestampColumn, endOfDay.toISOString());
        }
        return newQuery;
      };

      // Parameters for RPC calls
      const rpcParams = {
        start_date_param: startDate ? new Date(startDate).toISOString() : null,
        end_date_param: endDate ? new Date(endDate).toISOString() : null,
      };

      // 1. Document Status Counts using RPC
      const { data: docStatusData, error: docStatusError } = await supabase.rpc("count_documents_by_status", rpcParams);

      // 2. Signature Request Status Counts using RPC
      const { data: sigStatusData, error: sigStatusError } = await supabase.rpc("count_signature_requests_by_status", rpcParams);

      // 3. User Role Counts using RPC
      const { data: userRoleData, error: userRoleError } = await supabase.rpc("count_users_by_role", rpcParams);

      // 4. Incident Report Status Counts using RPC
      const { data: incidentStatusData, error: incidentStatusError } = await supabase.rpc("count_incident_reports_by_status", rpcParams);

      // 5. Total Counts (direct selects with client-side date filtering helper)
      let totalDocsQuery = supabase.from("documents").select("*", { count: "exact", head: true });
      totalDocsQuery = applyDateFilterToQuery(totalDocsQuery, "created_at", startDate, endDate);
      const { count: totalDocs, error: totalDocsError } = await totalDocsQuery;

      let totalSigsQuery = supabase.from("signature_requests").select("*", { count: "exact", head: true });
      totalSigsQuery = applyDateFilterToQuery(totalSigsQuery, "requested_at", startDate, endDate);
      const { count: totalSigs, error: totalSigsError } = await totalSigsQuery;

      let totalUsersQuery = supabase.from("users").select("*", { count: "exact", head: true });
      totalUsersQuery = applyDateFilterToQuery(totalUsersQuery, "created_at", startDate, endDate);
      const { count: totalUsers, error: totalUsersError } = await totalUsersQuery;

      let totalIncidentsQuery = supabase.from("incident_reports").select("*", { count: "exact", head: true });
      totalIncidentsQuery = applyDateFilterToQuery(totalIncidentsQuery, "timestamp", startDate, endDate);
      const { count: totalIncidents, error: totalIncidentsError } = await totalIncidentsQuery;

      // 6. Recent Audit Logs (direct select with client-side date filtering helper)
      let auditLogsQuery = supabase.from("audit_logs").select("timestamp, event_type, user_email, details");
      auditLogsQuery = applyDateFilterToQuery(auditLogsQuery, "timestamp", startDate, endDate);
      const { data: auditLogs, error: auditLogsError } = await auditLogsQuery.order("timestamp", { ascending: false }).limit(10); // Adjust limit as needed

      // 7. Calculate Average Signing Time (direct select with client-side date filtering helper)
      let avgSigningTime = "N/A";
      let signedReqsQuery = supabase.from("signature_requests").select("requested_at, signed_at").eq("status", "signed").not("signed_at", "is", null);
      signedReqsQuery = applyDateFilterToQuery(signedReqsQuery, "signed_at", startDate, endDate); // Filter by signed_at for this metric
      const { data: signedReqs, error: signedReqsError } = await signedReqsQuery;

      if (!signedReqsError && signedReqs && signedReqs.length > 0) {
        let totalDurationSeconds = 0;
        signedReqs.forEach((req) => {
          if (req.requested_at && req.signed_at) {
            const start = new Date(req.requested_at);
            const end = new Date(req.signed_at);
            totalDurationSeconds += (end.getTime() - start.getTime()) / 1000;
          }
        });
        const averageSeconds = totalDurationSeconds / signedReqs.length;
        const minutes = Math.floor(averageSeconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        const remainingSeconds = Math.floor(averageSeconds % 60);
        avgSigningTime = `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
      }

      if (docStatusError || sigStatusError || userRoleError || incidentStatusError || totalDocsError || totalSigsError || totalUsersError || totalIncidentsError || auditLogsError || signedReqsError) {
        console.error(
          "Error fetching report data:",
          docStatusError,
          sigStatusError,
          userRoleError,
          incidentStatusError,
          totalDocsError,
          totalSigsError,
          totalUsersError,
          totalIncidentsError,
          auditLogsError,
          signedReqsError
        );
        setNotification({
          message: "Failed to fetch all report data. Check console for details.",
          type: "error",
        });
      } else {
        setReportData({
          documentStatus: docStatusData || [],
          signatureStatus: sigStatusData || [],
          userRoles: userRoleData || [],
          incidentStatus: incidentStatusData || [],
          totalDocuments: totalDocs || 0,
          totalSignatureRequests: totalSigs || 0,
          totalUsers: totalUsers || 0,
          totalIncidentReports: totalIncidents || 0,
          averageSigningTime: avgSigningTime,
          recentAuditLogs: auditLogs || [],
        });
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
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]); // Dependency on memoized fetchReports

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
        <p className="text-xl">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen-minus-navbar bg-brand-bg-light text-brand-text">
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      <header className="mb-8 border-b border-brand-border-light pb-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-brand-heading">Analytics & Reports</h1>
        <p className="text-brand-text-light mt-2">Get insights into system performance and user activity.</p>
      </header>

      {/* Date Range Filter */}
      <section className="bg-brand-card p-6 rounded-lg shadow-card mb-6 flex flex-col md:flex-row gap-4 justify-end items-center">
        <div>
          <label htmlFor="reportStartDate" className="block text-sm font-medium text-brand-text mb-1">
            Start Date
          </label>
          <input
            type="date"
            id="reportStartDate"
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="reportEndDate" className="block text-sm font-medium text-brand-text mb-1">
            End Date
          </label>
          <input
            type="date"
            id="reportEndDate"
            className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button
          onClick={fetchReports} // Re-fetch data with new dates
          className="mt-4 md:mt-0 px-6 py-2 bg-color-button-primary text-white rounded-md hover:bg-color-button-primary-hover transition-colors duration-200"
        >
          Apply Filter
        </button>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border">
          <h3 className="text-lg font-semibold text-brand-heading mb-2">Total Documents</h3>
          <p className="text-4xl font-bold text-color-button-primary">{reportData.totalDocuments}</p>
        </div>
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border">
          <h3 className="text-lg font-semibold text-brand-heading mb-2">Total Sign Requests</h3>
          <p className="text-4xl font-bold text-color-button-primary">{reportData.totalSignatureRequests}</p>
        </div>
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border">
          <h3 className="text-lg font-semibold text-brand-heading mb-2">Total Users</h3>
          <p className="text-4xl font-bold text-color-button-primary">{reportData.totalUsers}</p>
        </div>
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border">
          <h3 className="text-lg font-semibold text-brand-heading mb-2">Avg. Signing Time</h3>
          <p className="text-4xl font-bold text-color-button-primary">{reportData.averageSigningTime}</p>
        </div>
      </section>

      {/* Detailed Report Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Status Report */}
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border">
          <h3 className="text-xl font-semibold text-brand-heading mb-4">Documents by Status</h3>
          {reportData.documentStatus.length > 0 ? (
            <div className="h-64">
              {/* Placeholder for a chart (e.g., PieChart from Recharts) */}
              {/*
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportData.documentStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label
                  >
                    {reportData.documentStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              */}
              <ul className="list-disc pl-5 text-brand-text-light">
                {reportData.documentStatus.map((item) => (
                  <li key={item.status}>
                    {item.status.replace(/_/g, " ").toUpperCase()}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-brand-text-light">No document status data available for this period.</p>
          )}
        </div>

        {/* Signature Request Status Report */}
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border">
          <h3 className="text-xl font-semibold text-brand-heading mb-4">Signature Requests by Status</h3>
          {reportData.signatureStatus.length > 0 ? (
            <div className="h-64">
              {/* Placeholder for a chart (e.g., BarChart or PieChart) */}
              {/*
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.signatureStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
              */}
              <ul className="list-disc pl-5 text-brand-text-light">
                {reportData.signatureStatus.map((item) => (
                  <li key={item.status}>
                    {item.status.replace(/_/g, " ").toUpperCase()}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-brand-text-light">No signature request status data available for this period.</p>
          )}
        </div>

        {/* User Roles Report */}
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border">
          <h3 className="text-xl font-semibold text-brand-heading mb-4">Users by Role</h3>
          {reportData.userRoles.length > 0 ? (
            <div className="h-64">
              <ul className="list-disc pl-5 text-brand-text-light">
                {reportData.userRoles.map((item) => (
                  <li key={item.role}>
                    {item.role.replace(/_/g, " ").toUpperCase()}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-brand-text-light">No user role data available.</p>
          )}
        </div>

        {/* Incident Reports Status Report */}
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border">
          <h3 className="text-xl font-semibold text-brand-heading mb-4">Incident Reports by Status</h3>
          {reportData.incidentStatus.length > 0 ? (
            <div className="h-64">
              <ul className="list-disc pl-5 text-brand-text-light">
                {reportData.incidentStatus.map((item) => (
                  <li key={item.status}>
                    {item.status.replace(/_/g, " ").toUpperCase()}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-brand-text-light">No incident report data available for this period.</p>
          )}
        </div>

        {/* Recent Audit Logs */}
        <div className="bg-brand-card p-6 rounded-lg shadow-card border border-brand-border lg:col-span-2">
          <h3 className="text-xl font-semibold text-brand-heading mb-4">Recent System Activity (Audit Logs)</h3>
          {reportData.recentAuditLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-border">
                <thead className="bg-brand-bg-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Event Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">User Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-light uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-brand-card divide-y divide-brand-border">
                  {reportData.recentAuditLogs.map((log) => (
                    <tr key={log.id || log.timestamp + log.event_type} className="hover:bg-brand-bg-dark transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{formatTimestamp(log.timestamp)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{log.event_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">{log.user_email || "System"}</td>
                      <td className="px-6 py-4 text-sm text-brand-text overflow-hidden text-ellipsis max-w-xs">
                        <pre className="whitespace-pre-wrap text-xs text-brand-text-light">{JSON.stringify(log.details, null, 2)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-brand-text-light">No recent audit logs available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
