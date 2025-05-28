import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Notification from "./components/Notification";
import { supabase } from "../utils/supabaseClient";

const MyProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null); // Supabase auth user object
  const [profile, setProfile] = useState({
    // Data from public.users table
    full_name: "",
    title: "",
    department: "",
    email: "", // Will be populated from auth.user for display
    role: "",
    is_verified: false,
    created_at: "",
    updated_at: "",
  });
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);

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

      setUser(authUser); // Store the auth user object

      // Fetch user profile from the public.users table
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("full_name, title, department, role, is_verified, created_at, updated_at")
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
          email: authUser.email, // Use email from auth.user
          role: userProfile.role || "user",
          is_verified: userProfile.is_verified || false,
          created_at: userProfile.created_at || "",
          updated_at: userProfile.updated_at || "",
        });
      }

      setLoading(false);
      setNotification({ message: "", type: "" }); // Clear info notification
    };

    fetchUserProfile();
  }, [navigate]);

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

    // Update the public.users table
    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: profile.full_name,
        title: profile.title,
        department: profile.department,
        updated_at: new Date().toISOString(), // Manually update updated_at
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
      // Re-fetch profile to ensure UI is in sync with database, especially for updated_at
      const { data: updatedProfile, error: refetchError } = await supabase
        .from("users")
        .select("full_name, title, department, role, is_verified, created_at, updated_at")
        .eq("id", user.id)
        .single();

      if (!refetchError && updatedProfile) {
        setProfile((prev) => ({
          ...prev,
          ...updatedProfile,
          email: user.email, // Email comes from auth.user, not public.users
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
        message:
          "Password updated successfully! For security, you might be logged out and need to re-login.",
        type: "success",
      });
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
      setTimeout(() => {
        setNotification({ message: "", type: "" });
        navigate("/login"); // Force re-login after password change for security
      }, 3000);
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
      {notification.message && (
        <Notification message={notification.message} type={notification.type} />
      )}

      {loading ? (
        <div className="text-center p-24 text-2xl text-[var(--brand-text-light)]">
          Loading profile data...
        </div>
      ) : (
        <div
          className="bg-[var(--brand-card)] rounded-2xl shadow-xl p-8 md:p-12 border border-[var(--brand-border-light)]
                     max-w-4xl w-full mx-auto my-12 animate-fade-in-up"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--brand-heading)] mb-8 text-center drop-shadow-md">
            My Profile
          </h1>

          {/* Profile Information Section */}
          <section className="mb-10 pb-6 border-b border-[var(--brand-border)]">
            <h2 className="text-3xl font-bold text-[var(--brand-heading)] mb-6">
              Personal Information
            </h2>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[var(--brand-text-light)] mb-2"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={profile.email}
                  disabled // Email is usually not directly editable via profile forms
                  className="w-full p-3 rounded-lg border border-[var(--brand-border)] bg-gray-100 dark:bg-gray-700
                             text-[var(--brand-text)] cursor-not-allowed"
                />
              </div>
              <div>
                <label
                  htmlFor="full_name"
                  className="block text-sm font-medium text-[var(--brand-text-light)] mb-2"
                >
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
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-[var(--brand-text-light)] mb-2"
                >
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
                <label
                  htmlFor="department"
                  className="block text-sm font-medium text-[var(--brand-text-light)] mb-2"
                >
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
              {/* <div className="flex justify-between items-center py-2 border-b border-[var(--brand-border-light)] last:border-b-0">
                <span className="text-lg font-medium text-[var(--brand-text)]">
                  Verified Status:
                </span>
                <span
                  className={`text-lg font-semibold ${
                    profile.is_verified
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-error)]"
                  }`}
                >
                  {profile.is_verified ? "Verified" : "Not Verified"}
                </span>
              </div> */}
              <div className="flex justify-between items-center py-2 border-b border-[var(--brand-border-light)] last:border-b-0">
                <span className="text-lg font-medium text-[var(--brand-text)]">Member Since:</span>
                <span className="text-lg text-[var(--brand-text-light)]">
                  {formatDate(profile.created_at)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 last:border-b-0">
                <span className="text-lg font-medium text-[var(--brand-text)]">Last Updated:</span>
                <span className="text-lg text-[var(--brand-text-light)]">
                  {formatDate(profile.updated_at)}
                </span>
              </div>
            </div>
          </section>

          {/* Account Settings Section - Password Change */}
          <section>
            <h2 className="text-3xl font-bold text-[var(--brand-heading)] mb-6">
              Account Settings
            </h2>

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
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-[var(--brand-text-light)] mb-2"
                  >
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
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-[var(--brand-text-light)] mb-2"
                  >
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
    </div>
  );
};

export default MyProfilePage;
