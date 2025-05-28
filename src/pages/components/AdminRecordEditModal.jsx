import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";
import Notification from "../components/Notification";
import Modal from "../components/Modal";

const AdminRecordEditModal = ({ show, onClose, tableName, record, onSaveSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [formData, setFormData] = useState({}); // State for editable form fields

  useEffect(() => {
    if (show && record) {
      setFormData(record); // Initialize form with current record data
      setNotification({ message: "", type: "" }); // Clear notifications
    }
  }, [show, record]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const getChangedFields = (oldData, newData) => {
    const changes = {};
    for (const key in newData) {
      // Exclude system fields if desired (e.g., id, created_at, updated_at)
      if (
        oldData[key] !== newData[key] &&
        key !== "id" &&
        key !== "created_at" &&
        key !== "updated_at" // Assuming updated_at is auto-handled by trigger
      ) {
        changes[key] = {
          old: oldData[key],
          new: newData[key],
        };
      }
    }
    return changes;
  };

  const handleSave = async () => {
    setLoading(true);
    setNotification({ message: "", type: "" });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      setNotification({ message: authError?.message || "Authentication required.", type: "error" });
      setLoading(false);
      return;
    }
    const adminUserId = userData.user.id;
    const adminUserEmail = userData.user.email; // Assuming user.email is available from auth

    try {
      // 1. Fetch the old record data BEFORE update
      const { data: oldRecord, error: fetchError } = await supabase.from(tableName).select("*").eq("id", record.id).single();

      if (fetchError) {
        throw new Error(`Failed to fetch old record for audit: ${fetchError.message}`);
      }

      // 2. Perform the update
      const { data, error: updateError } = await supabase.from(tableName).update(formData).eq("id", record.id).select(); // Select the updated data to get latest state

      if (updateError) {
        throw new Error(`Failed to update ${tableName} record: ${updateError.message}`);
      }

      // 3. Log the audit entry
      const changedFields = getChangedFields(oldRecord, formData); // Compare against form data, not the returned 'data' directly
      const auditDetails = {
        table_name: tableName,
        record_id: record.id,
        changes: changedFields,
        // Potentially include IP address if you capture it
        // ip_address: userIpAddress,
      };

      // Determine specific IDs to link audit log
      let linkedDocumentId = null;
      let linkedSignatureRequestId = null;
      let linkedUserId = null; // for users table changes

      if (tableName === "documents") {
        linkedDocumentId = record.id;
      } else if (tableName === "signature_requests") {
        linkedSignatureRequestId = record.id;
        linkedDocumentId = record.document_id; // Link to associated document
      } else if (tableName === "users") {
        linkedUserId = record.id; // Link to the user being modified
      } else if (tableName === "incident_reports") {
        linkedDocumentId = record.document_id;
        // You might also link to reported_by_user_id or resolved_by_user_id
      }
      // Add more conditions for other tables as needed

      const { error: auditError } = await supabase.from("audit_logs").insert({
        user_id: adminUserId,
        user_email: adminUserEmail,
        event_type: `${tableName.toUpperCase()}_UPDATED`, // Dynamic event type
        details: auditDetails,
        document_id: linkedDocumentId,
        signature_request_id: linkedSignatureRequestId,
        user_id: linkedUserId, // The user ID of the record being changed, not the admin
      });

      if (auditError) {
        console.warn("Audit log insertion failed:", auditError.message);
        // Do NOT block the user update, just log the warning
      }

      setNotification({ message: `${tableName} record updated successfully!`, type: "success" });
      onSaveSuccess(data[0]); // Pass the updated record back to the parent
      onClose();
    } catch (err) {
      console.error("Error during record update:", err);
      setNotification({ message: err.message || "An unexpected error occurred.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete this ${tableName} record? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setNotification({ message: "", type: "" });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      setNotification({ message: authError?.message || "Authentication required.", type: "error" });
      setLoading(false);
      return;
    }
    const adminUserId = userData.user.id;
    const adminUserEmail = userData.user.email;

    try {
      // 1. Fetch the record data BEFORE deletion for audit
      const { data: deletedRecord, error: fetchError } = await supabase.from(tableName).select("*").eq("id", record.id).single();

      if (fetchError) {
        throw new Error(`Failed to fetch record for audit before deletion: ${fetchError.message}`);
      }

      // 2. Perform the deletion
      const { error: deleteError } = await supabase.from(tableName).delete().eq("id", record.id);

      if (deleteError) {
        throw new Error(`Failed to delete ${tableName} record: ${deleteError.message}`);
      }

      // 3. Log the audit entry for deletion
      const auditDetails = {
        table_name: tableName,
        record_id: record.id,
        deleted_data: deletedRecord, // Store the full deleted record
        // ip_address: userIpAddress,
      };

      let linkedDocumentId = null;
      let linkedSignatureRequestId = null;
      let linkedUserId = null;

      if (tableName === "documents") {
        linkedDocumentId = record.id;
      } else if (tableName === "signature_requests") {
        linkedSignatureRequestId = record.id;
        linkedDocumentId = record.document_id;
      } else if (tableName === "users") {
        linkedUserId = record.id;
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        user_id: adminUserId,
        user_email: adminUserEmail,
        event_type: `${tableName.toUpperCase()}_DELETED`,
        details: auditDetails,
        document_id: linkedDocumentId,
        signature_request_id: linkedSignatureRequestId,
        user_id: linkedUserId,
      });

      if (auditError) {
        console.warn("Audit log insertion failed:", auditError.message);
      }

      setNotification({ message: `${tableName} record deleted successfully!`, type: "success" });
      onSaveSuccess(); // Indicate successful deletion to parent
      onClose();
    } catch (err) {
      console.error("Error during record deletion:", err);
      setNotification({ message: err.message || "An unexpected error occurred during deletion.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (!show || !record) return null; // Don't render if not visible or no record

  return (
    <Modal show={show} onClose={onClose}>
      <h2 className="text-xl font-semibold mb-4 text-brand-heading">Edit {tableName.replace("_", " ").toUpperCase()} Record</h2>
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      <div className="space-y-4 text-brand-text-light">
        {/* Dynamically render form fields based on record keys */}
        {Object.entries(formData).map(([key, value]) => {
          // You'll need more sophisticated rendering for foreign keys, dates, etc.
          // For simplicity, just handling text/numbers/booleans here.
          if (key === "id" || key === "created_at" || key === "updated_at" || key.endsWith("_id")) {
            // Display IDs or timestamps, but don't allow direct editing here
            // For foreign keys, you'd want a lookup/dropdown
            return (
              <p key={key}>
                <strong>{key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:</strong> {String(value)}
              </p>
            );
          }
          if (typeof value === "boolean") {
            return (
              <div key={key}>
                <label className="block text-sm font-medium text-brand-text">
                  <input type="checkbox" name={key} checked={value} onChange={handleChange} className="mr-2" />
                  {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </label>
              </div>
            );
          }
          // Default to text input
          return (
            <div key={key}>
              <label htmlFor={key} className="block text-sm font-medium text-brand-text mb-1">
                {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:
              </label>
              <input
                type={typeof value === "number" ? "number" : "text"} // Basic type handling
                id={key}
                name={key}
                value={value || ""}
                onChange={handleChange}
                className="w-full p-2 rounded-md border border-brand-border bg-brand-bg-light text-brand-text focus:outline-none focus:ring-2 focus:ring-color-button-primary"
              />
            </div>
          );
        })}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border border-brand-border-light text-brand-text rounded-md hover:bg-brand-bg-dark transition-colors duration-200">
            Cancel
          </button>
          <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200" disabled={loading}>
            {loading ? "Deleting..." : "Delete Record"}
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-color-button-primary text-white rounded-md hover:bg-color-button-primary-hover transition-colors duration-200" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminRecordEditModal;
