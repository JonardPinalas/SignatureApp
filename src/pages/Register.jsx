import React, { useState } from "react";
import { Link } from "react-router-dom";
import Notification from "./components/Notification";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notification, setNotification] = useState(null); // <--- New state for notification

  const handleSubmit = (e) => {
    e.preventDefault();
    setNotification(null); // Clear any existing notification

    if (!email || !password || !confirmPassword) {
      setNotification({ message: "Please fill in all fields.", type: "error" });
      return;
    }

    if (password !== confirmPassword) {
      setNotification({ message: "Passwords do not match.", type: "error" });
      return;
    }

    if (password.length < 6) {
      setNotification({ message: "Password must be at least 6 characters long.", type: "error" });
      return;
    }

    console.log("Registration attempt:", { email, password });
    setNotification({ message: "Registration successful! You can now log in.", type: "success" }); // <--- Use Notification
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    // Optionally, redirect to login page after a short delay
    // setTimeout(() => {
    //   window.location.href = '/login'; // Use navigate('/login') with React Router
    // }, 2000);
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
          <a
            href="/SignatureApp/login"
            className="text-[var(--color-button-primary)] hover:text-[var(--color-text-accent-light)] font-semibold transition duration-200"
          >
            Login here
          </a>
        </p>
      </div>

      {/* Render the Notification component */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)} // Clear notification state when it closes
        />
      )}

      <style jsx>{`
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
