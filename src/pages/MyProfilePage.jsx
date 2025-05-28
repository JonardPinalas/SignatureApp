import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Notification from "./components/Notification";
import { supabase } from "../utils/supabaseClient";
import TOTPEnrollmentModal from "./components/TOTPEnrollmentModal.jsx";
// TOTPUnenrollmentModal is no longer needed as unenrollment is now inline

const MyProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    full_name: "",
    title: "",
    department: "",
    email: "",
    role: "",
    is_verified: false,
    is_totp_enabled: false, // This will be the main flag for UI
    created_at: "",
    updated_at: "",
  });
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showTotpEnrollmentModal, setShowTotpEnrollmentModal] = useState(false);

  // NEW STATES FOR INLINE UNENROLLMENT
  const [enrolledFactors, setEnrolledFactors] = useState([]); // To display the list of factors
  const [factorIdToUnenroll, setFactorIdToUnenroll] = useState(""); // User input for the factor ID to unenroll
  const [unenrollLoading, setUnenrollLoading] = useState(false); // Loading state for unenrollment button
  const [unenrollError, setUnenrollError] = useState(""); // Specific error message for unenrollment

  // Helper function to update the `is_totp_enabled` in your database
  const updateProfileIsTotpEnabledInDb = async (isEnabled, userId) => {
    if (userId) {
      const { error } = await supabase.from("users").update({ is_totp_enabled: isEnabled, updated_at: new Date().toISOString() }).eq("id", userId);

      if (error) {
        console.error("Error updating is_totp_enabled in DB:", error);
        setNotification({
          message: `Failed to update 2FA status in database: ${error.message}`,
          type: "error",
        });
      }
    }
  };

  const fetchMFAStatus = async (authUser) => {
    if (!authUser) return;

    try {
      setLoading(true); // Ensure loading is true while fetching MFA status
      setUnenrollError(""); // Clear any previous unenroll errors when re-fetching status

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        console.error("Error listing MFA factors for profile page:", error);
        setNotification({
          message: "Failed to load 2FA status. Please try refreshing.",
          type: "error",
        });
        setProfile((prev) => ({ ...prev, is_totp_enabled: false }));
        setEnrolledFactors([]); // Clear factors on error
        return;
      }

      // Combine TOTP and Phone factors into a single list
      // Filter for 'verified' factors if you only want to show those that are active
      const allFactors = [...(data.totp || []), ...(data.phone || [])];
      const isEnabled = allFactors.some((f) => f.factor_type === "totp" && f.status === "verified");

      // Update local state first
      setProfile((prev) => {
        // Only update the DB if the status has actually changed to avoid unnecessary writes
        if (prev.is_totp_enabled !== isEnabled) {
          updateProfileIsTotpEnabledInDb(isEnabled, authUser.id);
        }
        return { ...prev, is_totp_enabled: isEnabled };
      });

      // Set the detailed factors for display, regardless of whether 2FA is currently enabled or not
      // This is useful if 2FA is technically 'disabled' but there are unverified factors or other types
      setEnrolledFactors(allFactors);
    } catch (err) {
      console.error("Unexpected error fetching MFA status:", err);
      setNotification({
        message: "An unexpected error occurred while checking 2FA status.",
        type: "error",
      });
      setProfile((prev) => ({ ...prev, is_totp_enabled: false }));
      setEnrolledFactors([]); // Clear factors on unexpected error
    } finally {
      setLoading(false); // Set loading to false once MFA status fetch is complete
    }
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      setNotification({ message: "Loading profile...", type: "info" });

      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        setNotification({
          message: "You need to be logged in to view your profile.",
          type: "error",
        });
        navigate("/login");
        return;
      }

      setUser(authUser);

      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("full_name, title, department, role, is_verified, is_totp_enabled, created_at, updated_at")
        .eq("id", authUser.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        setNotification({ message: "Error loading your profile data.", type: "error" });
        setLoading(false);
        return;
      }

      if (userProfile) {
        setProfile({
          full_name: userProfile.full_name || "",
          title: userProfile.title || "",
          department: userProfile.department || "",
          email: authUser.email,
          role: userProfile.role || "user",
          is_verified: userProfile.is_verified || false,
          // Initially use the DB value, but it will be overridden by fetchMFAStatus for accuracy
          is_totp_enabled: userProfile.is_totp_enabled || false,
          created_at: userProfile.created_at || "",
          updated_at: userProfile.updated_at || "",
        });
      }

      // After loading basic profile, fetch the actual MFA status from Supabase Auth
      await fetchMFAStatus(authUser);

      setLoading(false);
      setNotification({ message: "", type: "" });
    };

    fetchUserProfile();
  }, [navigate]); // Depend on navigate

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setNotification({ message: "Updating profile...", type: "info" });

    if (!user) {
      setNotification({ message: "No user session found.", type: "error" });
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: profile.full_name,
        title: profile.title,
        department: profile.department,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError.message);
      setNotification({
        message: `Error updating profile: ${updateError.message}`,
        type: "error",
      });
    } else {
      setNotification({ message: "Profile updated successfully!", type: "success" });
      setTimeout(() => setNotification({ message: "", type: "" }), 3000);
      const { data: updatedProfile, error: refetchError } = await supabase
        .from("users")
        .select("full_name, title, department, role, is_verified, is_totp_enabled, created_at, updated_at")
        .eq("id", user.id)
        .single();

      if (!refetchError && updatedProfile) {
        setProfile((prev) => ({
          ...prev,
          ...updatedProfile,
          email: user.email,
        }));
      }
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setNotification({ message: "Passwords do not match!", type: "error" });
      return;
    }
    if (newPassword.length < 6) {
      setNotification({ message: "Password must be at least 6 characters long.", type: "error" });
      return;
    }

    setNotification({ message: "Changing password...", type: "info" });

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("Error changing password:", error.message);
      setNotification({
        message: `Error changing password: ${error.message}`,
        type: "error",
      });
    } else {
      setNotification({
        message: "Password updated successfully! For security, you might be logged out and need to re-login.",
        type: "success",
      });
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
      setTimeout(() => {
        setNotification({ message: "", type: "" });
        navigate("/login");
      }, 3000);
    }
  };

  // Handler for when TOTP enrollment is successfully completed
  const handleTotpEnrolled = async () => {
    setNotification({ message: "Two-Factor Authentication has been successfully enabled!", type: "success" });
    setShowTotpEnrollmentModal(false);
    // After successful enrollment, refetch the true status from Supabase Auth and enrolled factors
    await fetchMFAStatus(user);
  };

  // Handler for when TOTP enrollment is cancelled
  const handleTotpEnrollmentCancelled = () => {
    setNotification({ message: "Two-Factor Authentication setup cancelled.", type: "info" });
    setShowTotpEnrollmentModal(false);
    // Re-check status in case enrollment was partially started or status was out of sync
    fetchMFAStatus(user);
  };

  // NEW: Handler for direct unenrollment on the profile page
  const handleUnenroll = async () => {
    setUnenrollError(""); // Clear any previous unenroll errors
    if (!factorIdToUnenroll) {
      setUnenrollError("Please enter the Factor ID to disable.");
      return;
    }

    setUnenrollLoading(true);
    try {
      const { error: unenrollErrorResponse } = await supabase.auth.mfa.unenroll({
        factorId: factorIdToUnenroll,
      });

      if (unenrollErrorResponse) {
        throw unenrollErrorResponse;
      }

      setNotification({ message: "Two-Factor Authentication successfully disabled!", type: "success" });
      setFactorIdToUnenroll(""); // Clear the input field
      // After successful unenrollment, refetch the true status from Supabase Auth and enrolled factors
      await fetchMFAStatus(user);
    } catch (err) {
      console.error("2FA Unenrollment Error:", err);
      setUnenrollError(err.message || "Failed to disable 2FA. Check the Factor ID and try again.");
      setNotification({ message: "Error disabling 2FA: " + (err.message || "Unknown error"), type: "error" });
    } finally {
      setUnenrollLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleString();
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center p-4 transition-colors duration-300 font-inter"
      style={{
        backgroundColor: "var(--brand-bg-light)",
        backgroundImage: "linear-gradient(135deg, var(--brand-bg-light), var(--brand-bg-dark))",
        color: "var(--brand-text)",
      }}
    >
      {notification.message && <Notification message={notification.message} type={notification.type} />}

      {loading ? (
        <div className="text-center p-24 text-2xl text-[var(--brand-text-light)]">Loading profile data...</div>
      ) : (
        <div
          className="bg-[var(--brand-card)] rounded-2xl shadow-xl p-8 md:p-12 border border-[var(--brand-border-light)]
                     max-w-4xl w-full mx-auto my-12 animate-fade-in-up"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--brand-heading)] mb-8 text-center drop-shadow-md">My Profile</h1>

          {/* Profile Information Section */}
          <section className="mb-10 pb-6 border-b border-[var(--brand-border)]">
            <h2 className="text-3xl font-bold text-[var(--brand-heading)] mb-6">Personal Information</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--brand-text-light)] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={profile.email}
                  disabled
                  className="w-full p-3 rounded-lg border border-[var(--brand-border)] bg-gray-100 dark:bg-gray-700
                             text-[var(--brand-text)] cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-[var(--brand-text-light)] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={profile.full_name}
                  onChange={handleProfileChange}
                  className="w-full p-3 rounded-lg border border-[var(--brand-border)] bg-gray-50 dark:bg-gray-800
                             text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-button-primary)]
                             transition-colors duration-200"
                />
              </div>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--brand-text-light)] mb-2">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={profile.title}
                  onChange={handleProfileChange}
                  className="w-full p-3 rounded-lg border border-[var(--brand-border)] bg-gray-50 dark:bg-gray-800
                             text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-button-primary)]
                             transition-colors duration-200"
                />
              </div>
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-[var(--brand-text-light)] mb-2">
                  Department
                </label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={profile.department}
                  onChange={handleProfileChange}
                  className="w-full p-3 rounded-lg border border-[var(--brand-border)] bg-gray-50 dark:bg-gray-800
                             text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-button-primary)]
                             transition-colors duration-200"
                />
              </div>
              <button
                type="submit"
                className="w-full inline-flex justify-center items-center
                           bg-gradient-to-br from-[var(--color-button-primary)] to-[var(--color-button-primary-hover)]
                           text-white border-none py-3 px-6 rounded-full font-bold text-lg shadow-md
                           transition-all duration-300 ease-out hover:from-[var(--color-button-primary-hover)]
                           hover:to-[var(--color-button-primary)] hover:translate-y-[-2px] hover:shadow-lg"
              >
                Update Profile
              </button>
            </form>
          </section>

          {/* Account Details Section (Read-only) */}
          <section className="mb-10 pb-6 border-b border-[var(--brand-border)]">
            <h2 className="text-3xl font-bold text-[var(--brand-heading)] mb-6">Account Details</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[var(--brand-border-light)] last:border-b-0">
                <span className="text-lg font-medium text-[var(--brand-text)]">Role:</span>
                <span className="text-lg text-[var(--brand-text-light)]">{profile.role}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--brand-border-light)] last:border-b-0">
                <span className="text-lg font-medium text-[var(--brand-text)]">Member Since:</span>
                <span className="text-lg text-[var(--brand-text-light)]">{formatDate(profile.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-2 last:border-b-0">
                <span className="text-lg font-medium text-[var(--brand-text)]">Last Updated:</span>
                <span className="text-lg text-[var(--brand-text-light)]">{formatDate(profile.updated_at)}</span>
              </div>
            </div>
          </section>

          {/* Two-Factor Authentication Section */}
          <section className="mb-10 pb-6 border-b border-[var(--brand-border)]">
            <h2 className="text-3xl font-bold text-[var(--brand-heading)] mb-6">Two-Factor Authentication (2FA)</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-lg font-medium text-[var(--brand-text)]">Status:</span>
                <span className={`text-lg font-semibold ${profile.is_totp_enabled ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
                  {profile.is_totp_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              {profile.is_totp_enabled ? (
                <>
                  <p className="text-sm text-[var(--brand-text-light)] mt-2">Two-Factor Authentication is active. You can disable it by entering the Factor ID below.</p>
                  {unenrollError && <p style={{ color: "red", marginTop: "10px" }}>Error: {unenrollError}</p>}

                  {enrolledFactors.length > 0 ? (
                    <div className="mt-4 mb-4" style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid var(--brand-border-light)", borderRadius: "8px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <thead>
                          <tr style={{ background: "var(--brand-bg-dark)", borderBottom: "1px solid var(--brand-border)" }}>
                            <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "0.9em", color: "var(--brand-text-light)", borderRight: "1px solid var(--brand-border-light)" }}>
                              Factor ID
                            </th>
                            <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "0.9em", color: "var(--brand-text-light)", borderRight: "1px solid var(--brand-border-light)" }}>
                              Friendly Name
                            </th>
                            <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "0.9em", color: "var(--brand-text-light)" }}>Type / Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrolledFactors.map((factor) => (
                            <tr key={factor.id} style={{ borderBottom: "1px solid var(--brand-border-light)" }}>
                              <td style={{ padding: "10px 8px", wordBreak: "break-all", fontSize: "0.85em", color: "var(--brand-text)" }}>{factor.id}</td>
                              <td style={{ padding: "10px 8px", fontSize: "0.85em", color: "var(--brand-text)" }}>{factor.friendly_name}</td>
                              <td style={{ padding: "10px 8px", fontSize: "0.85em", color: "var(--brand-text)" }}>{`${factor.factor_type} (${factor.status})`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--brand-text-light)]">No active 2FA factors found. This might be a temporary state or an issue with fetching.</p>
                  )}

                  <p className="block text-sm font-medium text-[var(--brand-text-light)] mb-2">Enter Factor ID to Disable:</p>
                  <input
                    type="text"
                    value={factorIdToUnenroll}
                    onChange={(e) => setFactorIdToUnenroll(e.target.value.trim())}
                    placeholder="Paste Factor ID here (e.g., 2c3e1f4a-...)"
                    className="w-full p-3 rounded-lg border border-[var(--brand-border)] bg-gray-50 dark:bg-gray-800
                               text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-button-primary)]
                               transition-colors duration-200"
                    disabled={unenrollLoading}
                  />
                  <button
                    onClick={handleUnenroll}
                    className="w-full inline-flex justify-center items-center
                               bg-red-500 text-white border-none py-3 px-6 rounded-full font-bold text-lg shadow-md
                               transition-all duration-300 ease-out hover:bg-red-600 hover:translate-y-[-2px] hover:shadow-lg
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={unenrollLoading || !factorIdToUnenroll}
                  >
                    {unenrollLoading ? "Disabling..." : "Disable 2FA"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowTotpEnrollmentModal(true)} // Open enrollment modal
                  className="w-full inline-flex justify-center items-center
                             bg-gradient-to-br from-[var(--color-button-primary)] to-[var(--color-button-primary-hover)]
                             text-white border-none py-3 px-6 rounded-full font-bold text-lg shadow-md
                             transition-all duration-300 ease-out hover:from-[var(--color-button-primary-hover)]
                             hover:to-[var(--color-button-primary)] hover:translate-y-[-2px] hover:shadow-lg"
                >
                  Enable 2FA
                </button>
              )}
            </div>
          </section>

          {/* Account Settings Section - Password Change */}
          <section>
            <h2 className="text-3xl font-bold text-[var(--brand-heading)] mb-6">Password Settings</h2>

            {!showPasswordChange ? (
              <button
                onClick={() => setShowPasswordChange(true)}
                className="inline-flex justify-center items-center
                           bg-transparent border-2 border-[var(--color-button-primary)] text-[var(--color-button-primary)]
                           py-3 px-6 rounded-full font-bold text-lg shadow-sm
                           transition-all duration-300 ease-out hover:bg-[var(--color-button-primary)]
                           hover:text-white hover:shadow-md"
              >
                Change Password
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-6 animate-fade-in-up">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--brand-text-light)] mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3 rounded-lg border border-[var(--brand-border)] bg-gray-50 dark:bg-gray-800
                               text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-button-primary)]
                               transition-colors duration-200"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--brand-text-light)] mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 rounded-lg border border-[var(--brand-border)] bg-gray-50 dark:bg-gray-800
                               text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-button-primary)]
                               transition-colors duration-200"
                    required
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 inline-flex justify-center items-center
                               bg-gradient-to-br from-[var(--color-button-primary)] to-[var(--color-button-primary-hover)]
                               text-white border-none py-3 px-6 rounded-full font-bold text-lg shadow-md
                               transition-all duration-300 ease-out hover:from-[var(--color-button-primary-hover)]
                               hover:to-[var(--color-button-primary)] hover:translate-y-[-2px] hover:shadow-lg"
                  >
                    Set New Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(false)}
                    className="flex-1 inline-flex justify-center items-center
                               bg-gray-300 text-gray-800 border-none py-3 px-6 rounded-full font-bold text-lg shadow-md
                               transition-all duration-300 ease-out hover:bg-gray-400 hover:translate-y-[-2px] hover:shadow-lg
                               dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* TOTP Enrollment Modal (still uses the modal) */}
      {showTotpEnrollmentModal && user && <TOTPEnrollmentModal show={showTotpEnrollmentModal} onClose={handleTotpEnrollmentCancelled} onEnrolled={handleTotpEnrolled} />}

      {/* TOTP Unenrollment Modal is no longer needed */}
    </div>
  );
};

export default MyProfilePage;
