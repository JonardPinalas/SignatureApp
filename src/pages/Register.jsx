import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notification from "./components/Notification";
import { supabase } from "../utils/supabaseClient";
import bcrypt from "bcryptjs"; // Import bcryptjs

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotification(null);

    // 1. Basic Form Validation
    if (!email || !password || !confirmPassword || !fullName || !title || !department) {
      setNotification({ message: "Please fill in all fields.", type: "error" });
      return;
    }
    if (password !== confirmPassword) {
      setNotification({ message: "Passwords do not match.", type: "error" });
      return;
    }
    if (password.length < 6) {
      setNotification({ message: "Password must be at least 6 characters.", type: "error" });
      return;
    }

    try {
      // 2. Register user with Supabase Auth
      // This handles the primary authentication and stores the password securely in auth.users
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email-success`,
        },
      });

      if (authError) {
        setNotification({ message: authError.message, type: "error" });
        return; // Stop if Auth registration fails
      }

      const userId = authData.user?.id || authData.session?.user?.id;

      if (!userId) {
        setNotification({
          message: "An unexpected error occurred: User ID not found after signup.",
          type: "error",
        });
        console.error("Auth data:", authData);
        return;
      }

      // --- CLIENT-SIDE PASSWORD HASHING FOR public.users TABLE ---
      let hashedPassword = null;
      try {
        const saltRounds = 10; // Adjust salt rounds for desired security/performance balance
        const salt = await bcrypt.genSalt(saltRounds);
        hashedPassword = await bcrypt.hash(password, salt);
      } catch (hashError) {
        console.error("Error hashing password with bcryptjs:", hashError);
        setNotification({
          message: "Failed to process password securely. Please try again.",
          type: "error",
        });
        // Consider deleting the user from auth.users here if hashing fails,
        // but this requires a service_role key and is typically done server-side for security.
        return;
      }
      // --- END CLIENT-SIDE PASSWORD HASHING ---

      // 3. Update additional user profile in your custom 'users' table
      // This updates the row that was created by the trigger with extra fields
      const { error: updateError } = await supabase
        .from("users")
        .update({
          password_hash: hashedPassword,
          full_name: fullName,
          title: title,
          department: department,
          is_verified: false,
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Error updating public.users table:", updateError.message);
        setNotification({
          message: "Registration failed: Could not save profile data. Please try again.",
          type: "error",
        });
        return;
      }

      // 4. Success Notification and Redirect
      setNotification({
        message: "Registration successful! Please check your email to verify your account.",
        type: "success",
      });

      // Clear form fields
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setFullName("");
      setTitle("");
      setDepartment("");

      // Optional: Redirect to a page that tells the user to check their email
      setTimeout(() => {
        navigate("/login?message=check_email");
      }, 3000);
    } catch (unexpectedError) {
      console.error("An unexpected error occurred:", unexpectedError);
      setNotification({
        message: "An unexpected error occurred during registration. Please try again.",
        type: "error",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] p-8 rounded-lg shadow-xl animate-fade-in-up">
        {/* SignSeal Text as a Link to Landing Page */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block no-underline">
            <h1
              className="text-4xl font-extrabold text-gray-800 dark:text-white
                           hover:text-gray-600 dark:hover:text-gray-300 transition duration-200 ease-in-out"
            >
              Register to <span className="text-[var(--color-button-primary)]">SignSeal</span>
            </h1>
          </Link>
        </div>

        <h2 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white sr-only">
          Register for SignSeal
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-3 rounded-md border border-gray-300 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-[var(--color-button-primary)] focus:border-transparent
                         transition duration-200 ease-in-out placeholder-gray-400"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-3 rounded-md border border-gray-300 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-[var(--color-button-primary)] focus:border-transparent
                         transition duration-200 ease-in-out placeholder-gray-400"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirm-password"
              className="w-full px-4 py-3 rounded-md border border-gray-300 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-[var(--color-button-primary)] focus:border-transparent
                         transition duration-200 ease-in-out placeholder-gray-400"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {/* Full Name */}
          <div>
            <label
              htmlFor="full-name"
              className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Full Name
            </label>
            <input
              type="text"
              id="full-name"
              className="w-full px-4 py-3 rounded-md border border-gray-300 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-[var(--color-button-primary)] focus:border-transparent
                         transition duration-200 ease-in-out placeholder-gray-400"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Title (e.g., Registrar, IT Head)
            </label>
            <input
              type="text"
              id="title"
              className="w-full px-4 py-3 rounded-md border border-gray-300 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-[var(--color-button-primary)] focus:border-transparent
                         transition duration-200 ease-in-out placeholder-gray-400"
              placeholder="Registrar"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Department */}
          <div>
            <label
              htmlFor="department"
              className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Department (e.g., IT, HR, Finance)
            </label>
            <input
              type="text"
              id="department"
              className="w-full px-4 py-3 rounded-md border border-gray-300 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-[var(--color-button-primary)] focus:border-transparent
                         transition duration-200 ease-in-out placeholder-gray-400"
              placeholder="IT"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)]
                       text-white font-bold py-3 px-6 rounded-md shadow-lg
                       transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2
                       focus:ring-[var(--color-button-primary)] focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Register
          </button>
        </form>

        <p className="text-center text-gray-600 dark:text-gray-400 mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-[var(--color-button-primary)] hover:text-[var(--color-text-accent-light)] font-semibold transition duration-200"
          >
            Login here
          </Link>
        </p>
      </div>

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Register;
