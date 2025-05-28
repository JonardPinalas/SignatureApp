import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Notification from "./components/Notification";
import { supabase } from "../utils/supabaseClient";

const RESEND_COOLDOWN_SECONDS = 120;

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notification, setNotification] = useState(null);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("message") === "check_email") {
      setNotification({
        message: "Registration successful! Please check your email to verify your account.",
        type: "success",
      });
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    let timer;
    const storedLastResend = localStorage.getItem("lastResendAttempt");

    if (storedLastResend) {
      const lastAttemptTime = parseInt(storedLastResend, 10);
      const timeElapsed = Math.floor((Date.now() - lastAttemptTime) / 1000);
      const timeLeft = RESEND_COOLDOWN_SECONDS - timeElapsed;

      if (timeLeft > 0) {
        setResendCooldown(true);
        setResendCountdown(timeLeft);
        timer = setInterval(() => {
          setResendCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setResendCooldown(false);
              localStorage.removeItem("lastResendAttempt");
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotification(null);
    setShowEmailVerificationModal(false);
    setShowBlockedModal(false);

    if (!email || !password) {
      setNotification({ message: "Please enter both email and password.", type: "error" });
      return;
    }

    try {
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipResponse.json();
      const ipAddress = ipData.ip || "unknown";
      const userAgent = navigator.userAgent || "unknown";

      let loginSuccess = false;
      let authErrorMessage = null;
      let authUserId = null;

      // --- STEP 1: Attempt login via Supabase Auth SDK ---
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        loginSuccess = false;
        authErrorMessage = authError.message;
        if (authError.message === "Email not confirmed") {
          setShowEmailVerificationModal(true);
        } else {
          // For "Invalid login credentials" or other general auth errors
          setNotification({ message: authError.message, type: "error" });
        }
      } else if (authData && authData.user) {
        loginSuccess = true;
        authUserId = authData.user.id;
      } else {
        // This case should ideally not happen for signInWithPassword
        loginSuccess = false;
        authErrorMessage = "An unexpected response from Supabase Auth.";
        setNotification({ message: authErrorMessage, type: "error" });
      }

      // --- STEP 2: Call RPC to track the attempt and apply business logic ---
      const { data: rpcResult, error: rpcError } = await supabase.rpc("track_login_attempt", {
        p_email: email,
        p_user_id: authUserId, // Pass userId if successful
        p_is_success: loginSuccess,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_auth_error_message: authErrorMessage, // Pass the original auth error message
      });

      if (rpcError) {
        console.error("RPC Error during tracking:", rpcError);
        setNotification({ message: `An error occurred while tracking login attempt: ${rpcError.message}`, type: "error" });
        // If RPC itself fails, we still might have the auth session, but log the issue
        return;
      }

      // --- STEP 3: Handle results from RPC (blocking, messages) ---
      if (rpcResult && rpcResult.blocked) {
        setShowBlockedModal(true);
        setNotification(null); // Modal takes precedence
        // Ensure user is logged out if they were blocked by RPC
        if (loginSuccess) {
          // If they somehow successfully logged in but were then blocked by RPC
          await supabase.auth.signOut();
        }
        return;
      }

      if (rpcResult && rpcResult.message && !loginSuccess) {
        // Display RPC message for failed attempts (e.g., too many attempts, temporary lockout)
        setNotification({ message: rpcResult.message, type: "error" });
        return;
      }

      // --- STEP 4: Final actions if login was successful and not blocked ---
      if (loginSuccess) {
        const userRole = authData.user.user_metadata?.role || "user";
        setNotification({ message: "Login successful!", type: "success" });

        if (userRole === "admin") {
          setTimeout(() => navigate("/admin/dashboard"), 500);
        } else {
          setTimeout(() => navigate("/user/dashboard"), 500);
        }
      } else {
        // This path should ideally be covered by specific authError or rpcResult messages
        // but as a fallback:
        setNotification({ message: "Login failed. Please check your credentials.", type: "error" });
      }
    } catch (err) {
      console.error("Overall login process error:", err);
      setNotification({ message: "An unexpected error occurred during the login process.", type: "error" });
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown) return;

    setNotification(null);
    setResendCooldown(true);
    setResendCountdown(RESEND_COOLDOWN_SECONDS);
    localStorage.setItem("lastResendAttempt", Date.now().toString());

    let countdownTimer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          setResendCooldown(false);
          localStorage.removeItem("lastResendAttempt");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/SignatureApp/verify-email-success`,
      },
    });

    if (error) {
      setNotification({
        message: `Failed to resend verification email: ${error.message}`,
        type: "error",
      });
    } else {
      setNotification({
        message: "Verification email sent! Please check your inbox.",
        type: "success",
      });
      setShowEmailVerificationModal(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] p-8 rounded-lg shadow-xl animate-fade-in-up">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block no-underline">
            <h1 className="text-4xl font-extrabold text-gray-800 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 transition duration-200 ease-in-out">
              Login to <span style={{ color: "var(--color-button-primary)" }}>SignSeal</span>
            </h1>
          </Link>
        </div>

        <h2 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white sr-only">Login to SignSeal</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
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
            <label htmlFor="password" className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)]
                          text-white font-bold py-3 px-6 rounded-md shadow-lg
                          transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2
                          focus:ring-[var(--color-button-primary)] focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Login
          </button>
        </form>

        <p className="text-center text-gray-600 dark:text-gray-400 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-[var(--color-button-primary)] hover:text-[var(--color-text-accent-light)] font-semibold transition duration-200">
            Register here
          </Link>
        </p>
      </div>

      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      {showEmailVerificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
            <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Email Verification Needed</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              To ensure the security of your account, please verify your email address. Kindly check your inbox and click the verification link we've sent.
            </p>
            <button
              onClick={handleResendVerification}
              disabled={resendCooldown}
              className={`
                font-bold py-2 px-4 rounded-md shadow-md
                transition duration-200 ease-in-out
                ${resendCooldown ? "bg-gray-400 cursor-not-allowed" : "bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white"}
              `}
            >
              {resendCooldown ? `Resend in ${resendCountdown}s` : "Resend Verification Email"}
            </button>
            <button
              onClick={() => setShowEmailVerificationModal(false)}
              className="ml-4 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600
                          text-gray-800 dark:text-white font-bold py-2 px-4 rounded-md shadow-md
                          transition duration-200 ease-in-out"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showBlockedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
            <h3 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">Account Blocked</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Your account has been blocked due to too many failed login attempts or administrator action. Please contact the administrator for assistance.
            </p>
            <button
              onClick={() => setShowBlockedModal(false)}
              className="bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200 ease-in-out"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
