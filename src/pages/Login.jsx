import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Notification from "./components/Notification";
import { supabase } from "../utils/supabaseClient";
import { sendEmail, resetEmailSentFlags } from "../utils/mailer"; // Import mailer utility

// Cooldown for resending verification email
const RESEND_COOLDOWN_SECONDS = 120;

// Frontend throttling constants
const THROTTLE_LIMIT = 5; // Number of failed attempts before temporary throttle
const THROTTLE_COOLDOWN_SECONDS = 60; // Cooldown duration for temporary throttle
const BLOCK_THRESHOLD_DB = 10; // Number of failed attempts in DB before account is blocked

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notification, setNotification] = useState(null);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false); // Used for DB-triggered block
  const [showFrontendThrottledModal, setShowFrontendThrottledModal] = useState(false);

  // State for resend email cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);

  // State for frontend login throttle (local storage based)
  const [frontendFailedLoginAttempts, setFrontendFailedLoginAttempts] = useState(0);
  const [lastFrontendFailedLoginTime, setLastFrontendFailedLoginTime] = useState(null);
  const [loginThrottleCountdown, setLoginThrottleCountdown] = useState(0);
  const loginThrottleTimerRef = useRef(null);

  // State for backend-driven user status (fetched from public.users)
  const [isUserBlockedInDb, setIsUserBlockedInDb] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Effect for initial message from registration
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

  // Effect for resend email cooldown timer
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

  // Effect for frontend login throttle timer (local storage based)
  useEffect(() => {
    const storedFrontendFailedAttempts = localStorage.getItem(`failedLoginAttempts_${email}`);
    const storedLastFrontendAttemptTime = localStorage.getItem(`lastFailedLoginTime_${email}`);

    if (storedFrontendFailedAttempts) {
      setFrontendFailedLoginAttempts(parseInt(storedFrontendFailedAttempts, 10));
    }
    if (storedLastFrontendAttemptTime) {
      setLastFrontendFailedLoginTime(parseInt(storedLastFrontendAttemptTime, 10));
    }

    if (storedLastFrontendAttemptTime && parseInt(storedFrontendFailedAttempts, 10) >= THROTTLE_LIMIT) {
      const lastAttempt = parseInt(storedLastFrontendAttemptTime, 10);
      const timeElapsed = Math.floor((Date.now() - lastAttempt) / 1000);
      const timeLeft = THROTTLE_COOLDOWN_SECONDS - timeElapsed;

      if (timeLeft > 0) {
        setLoginThrottleCountdown(timeLeft);
        setShowFrontendThrottledModal(true);
        if (loginThrottleTimerRef.current) {
          clearInterval(loginThrottleTimerRef.current);
        }
        loginThrottleTimerRef.current = setInterval(() => {
          setLoginThrottleCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(loginThrottleTimerRef.current);
              loginThrottleTimerRef.current = null;
              setShowFrontendThrottledModal(false);
              // Reset failed attempts and last attempt time after cooldown
              localStorage.removeItem(`failedLoginAttempts_${email}`);
              localStorage.removeItem(`lastFailedLoginTime_${email}`);
              setFrontendFailedLoginAttempts(0);
              setLastFrontendFailedLoginTime(null);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setShowFrontendThrottledModal(false);
        localStorage.removeItem(`failedLoginAttempts_${email}`);
        localStorage.removeItem(`lastFailedLoginTime_${email}`);
        setFrontendFailedLoginAttempts(0);
        setLastFrontendFailedLoginTime(null);
      }
    }

    return () => {
      if (loginThrottleTimerRef.current) {
        clearInterval(loginThrottleTimerRef.current);
      }
    };
  }, [email]);

  // Effect to fetch user's block status from DB on email change or component mount
  // This helps to immediately show the blocked modal if the user is already blocked in DB.
  useEffect(() => {
    const fetchUserBlockStatus = async () => {
      if (!email) {
        setIsUserBlockedInDb(false);
        setShowBlockedModal(false);
        return;
      }
      try {
        const { data, error } = await supabase.from("users").select("blocked").eq("email", email).single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 means no rows found
          console.error("Error fetching user block status:", error);
          // Handle error, e.g., set a notification
          return;
        }

        if (data && data.blocked) {
          setIsUserBlockedInDb(true);
          setShowBlockedModal(true);
          setNotification(null); // Clear other notifications
        } else {
          setIsUserBlockedInDb(false);
          setShowBlockedModal(false);
        }
      } catch (err) {
        console.error("Unexpected error fetching user block status:", err);
      }
    };

    fetchUserBlockStatus();
  }, [email]); // Re-fetch when email changes

  // Function to update failed login attempts in localStorage (for frontend throttle)
  const updateFrontendFailedAttempts = (currentEmail, increment = true) => {
    let currentAttempts = parseInt(localStorage.getItem(`failedLoginAttempts_${currentEmail}`) || "0", 10);
    let newAttempts;

    if (increment) {
      newAttempts = currentAttempts + 1;
    } else {
      newAttempts = 0; // Reset on success
    }

    setFrontendFailedLoginAttempts(newAttempts);
    localStorage.setItem(`failedLoginAttempts_${currentEmail}`, newAttempts.toString());

    if (newAttempts > 0 && increment) {
      const now = Date.now();
      setLastFrontendFailedLoginTime(now);
      localStorage.setItem(`lastFailedLoginTime_${currentEmail}`, now.toString());
    } else {
      setLastFrontendFailedLoginTime(null);
      localStorage.removeItem(`lastFailedLoginTime_${currentEmail}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotification(null);
    setShowEmailVerificationModal(false);
    setShowBlockedModal(false);
    setShowFrontendThrottledModal(false);

    if (!email || !password) {
      setNotification({ message: "Please enter both email and password.", type: "error" });
      return;
    }

    // --- Frontend Throttle Check (local storage based) ---
    const currentFrontendAttempts = parseInt(localStorage.getItem(`failedLoginAttempts_${email}`) || "0", 10);
    const lastFrontendAttemptTime = parseInt(localStorage.getItem(`lastFailedLoginTime_${email}`) || "0", 10);

    if (currentFrontendAttempts >= THROTTLE_LIMIT) {
      const timeElapsed = Math.floor((Date.now() - lastFrontendAttemptTime) / 1000);
      const timeLeft = THROTTLE_COOLDOWN_SECONDS - timeElapsed;

      if (timeLeft > 0) {
        setLoginThrottleCountdown(timeLeft);
        setShowFrontendThrottledModal(true);
        setNotification({ message: `Too many failed login attempts. Please try again in ${timeLeft} seconds.`, type: "error" });

        if (loginThrottleTimerRef.current) {
          clearInterval(loginThrottleTimerRef.current);
        }
        loginThrottleTimerRef.current = setInterval(() => {
          setLoginThrottleCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(loginThrottleTimerRef.current);
              loginThrottleTimerRef.current = null;
              setShowFrontendThrottledModal(false);
              localStorage.removeItem(`failedLoginAttempts_${email}`);
              localStorage.removeItem(`lastFailedLoginTime_${email}`);
              setFrontendFailedLoginAttempts(0);
              setLastFrontendFailedLoginTime(null);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return; // Prevent login attempt
      } else {
        setShowFrontendThrottledModal(false);
        localStorage.removeItem(`failedLoginAttempts_${email}`);
        localStorage.removeItem(`lastFailedLoginTime_${email}`);
        setFrontendFailedLoginAttempts(0);
        setLastFrontendFailedLoginTime(null);
      }
    }

    // --- Check if user is already blocked in DB (from previous attempts) ---
    // This check is performed before attempting Supabase Auth login to save resources.
    if (isUserBlockedInDb) {
      setShowBlockedModal(true);
      setNotification({ message: "Your account has been blocked. Please contact the administrator.", type: "error" });
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
        updateFrontendFailedAttempts(email, true); // Increment frontend failed attempts

        // --- Fetch user's current status from DB for backend logic ---
        const { data: userData, error: userFetchError } = await supabase.from("users").select("id, failed_login_attempts, blocked").eq("email", email).single();

        let userIdForDbUpdate = null;
        let currentDbFailedAttempts = 0;
        let currentDbBlockedStatus = false;

        if (userData) {
          userIdForDbUpdate = userData.id;
          currentDbFailedAttempts = userData.failed_login_attempts || 0;
          currentDbBlockedStatus = userData.blocked;
        } else if (userFetchError && userFetchError.code !== "PGRST116") {
          // PGRST116 means no rows found
          console.error("Error fetching user status for DB update on failed login:", userFetchError);
          setNotification({ message: "A system error occurred. Please try again later.", type: "error" });
          return;
        }

        // --- Update backend failed attempts and block status in DB ---
        if (userIdForDbUpdate) {
          // Only proceed if user exists in public.users
          let newDbFailedAttempts = currentDbFailedAttempts + 1;
          let newBlockedStatus = currentDbBlockedStatus;

          // Check for malicious warning (5 attempts)
          if (newDbFailedAttempts === THROTTLE_LIMIT) {
            // Send if it's exactly 5
            // CORRECTED: Ensure 'warning' string literal is passed
            sendEmail("warning", email, { attempts: newDbFailedAttempts, ip_address: ipAddress });
          }

          // Check for permanent block (10 attempts)
          if (newDbFailedAttempts >= BLOCK_THRESHOLD_DB && !currentDbBlockedStatus) {
            newBlockedStatus = true;
            // CORRECTED: Ensure 'blocked' string literal is passed
            sendEmail("blocked", email, { attempts: newDbFailedAttempts, ip_address: ipAddress });
            setShowBlockedModal(true); // Show backend-driven block modal
            setNotification(null); // Clear other notifications
          }

          await supabase
            .from("users")
            .update({
              failed_login_attempts: newDbFailedAttempts,
              last_failed_login_at: new Date().toISOString(),
              blocked: newBlockedStatus,
            })
            .eq("id", userIdForDbUpdate);

          setIsUserBlockedInDb(newBlockedStatus); // Update state with new block status
        }

        if (authError.message === "Email not confirmed") {
          setShowEmailVerificationModal(true);
        } else {
          setNotification({ message: authError.message, type: "error" });
        }
      } else if (authData && authData.user) {
        loginSuccess = true;
        authUserId = authData.user.id;
        updateFrontendFailedAttempts(email, false); // Reset frontend failed attempts

        // --- Reset backend failed attempts and unblock on successful login ---
        await supabase
          .from("users")
          .update({
            failed_login_attempts: 0,
            last_failed_login_at: null,
            blocked: false, // Ensure unblocked on successful login
          })
          .eq("id", authUserId);

        setIsUserBlockedInDb(false); // Update state to unblocked
        resetEmailSentFlags(email); // Reset email sent flags for this user in localStorage

        setNotification({ message: "Login successful!", type: "success" });
        const userRole = authData.user.user_metadata?.role || "user";
        if (userRole === "admin") {
          setTimeout(() => navigate("/admin/dashboard"), 500);
        } else {
          setTimeout(() => navigate("/user/dashboard"), 500);
        }
      } else {
        // This case should ideally not happen for signInWithPassword
        loginSuccess = false;
        authErrorMessage = "An unexpected response from Supabase Auth.";
        setNotification({ message: authErrorMessage, type: "error" });
        updateFrontendFailedAttempts(email, true); // Increment frontend failed attempts
      }
    } catch (err) {
      console.error("Overall login process error:", err);
      setNotification({ message: "An unexpected error occurred during the login process.", type: "error" });
      updateFrontendFailedAttempts(email, true); // Increment frontend failed attempts even for unexpected errors
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
              onChange={(e) => {
                setEmail(e.target.value);
                setShowFrontendThrottledModal(false);
                setLoginThrottleCountdown(0);
                if (loginThrottleTimerRef.current) {
                  clearInterval(loginThrottleTimerRef.current);
                  loginThrottleTimerRef.current = null;
                }
                const storedFrontendFailedAttempts = localStorage.getItem(`failedLoginAttempts_${e.target.value}`);
                const storedLastFrontendAttemptTime = localStorage.getItem(`lastFailedLoginTime_${e.target.value}`);
                setFrontendFailedLoginAttempts(parseInt(storedFrontendFailedAttempts || "0", 10));
                setLastFrontendFailedLoginTime(parseInt(storedLastFrontendAttemptTime || "0", 10));

                // Reset email sent flags when email changes
                resetEmailSentFlags(e.target.value); // Use the new utility function
              }}
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
            disabled={showFrontendThrottledModal || isUserBlockedInDb} // Disable button if throttled or blocked in DB
            className={`w-full text-white font-bold py-3 px-6 rounded-md shadow-lg
                        transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2
                        focus:ring-[var(--color-button-primary)] focus:ring-offset-2 dark:focus:ring-offset-gray-900
                        ${showFrontendThrottledModal || isUserBlockedInDb ? "bg-gray-400 cursor-not-allowed" : "bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)]"}`}
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

      {/* Backend-triggered block modal */}
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

      {/* Frontend-triggered throttle modal */}
      {showFrontendThrottledModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
            <h3 className="text-2xl font-bold mb-4 text-yellow-600 dark:text-yellow-400">Too Many Login Attempts!</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">You have made too many failed login attempts. Please try again in {loginThrottleCountdown} seconds.</p>
            <button
              onClick={() => setShowFrontendThrottledModal(false)}
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
