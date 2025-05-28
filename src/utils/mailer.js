import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_WARNING_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_WARNING_TEMPLATE_ID; // Dedicated warning template
const EMAILJS_BLOCKED_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_BLOCKED_TEMPLATE_ID; // Dedicated blocked template
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// Initialize EmailJS once when this module is loaded
if (EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY' && EMAILJS_PUBLIC_KEY !== undefined) {
  emailjs.init(EMAILJS_PUBLIC_KEY);
} else {
  console.warn("⚠️ EmailJS Public Key is not configured in .env or is still a placeholder. Email sending will not work.");
}

// Helper to manage email sent flags in localStorage
const setEmailSentFlag = (key, value) => {
  localStorage.setItem(key, value);
};

const getEmailSentFlag = (key) => {
  return localStorage.getItem(key);
};

/**
 * Sends an email using EmailJS based on a template type.
 * Ensures the email is sent only once per user per event type (using localStorage).
 *
 * @param {'warning' | 'blocked'} eventType - The type of event triggering the email ('warning' or 'blocked').
 * @param {string} userEmail - The recipient's email address.
 * @param {object} additionalParams - Optional additional parameters for the EmailJS template (e.g., attempts, ip_address).
 */
export const sendEmail = async (eventType, userEmail, additionalParams = {}) => {
  let emailSentLocalStorageKey;
  let subjectForLogging;
  let templateIdToSend;

  // Validate and prepare additionalParams with fallbacks
  const params = {
    to_email: userEmail,
    attempts: additionalParams.attempts || 'N/A', // Fallback for attempts
    ip_address: additionalParams.ip_address || 'N/A', // Fallback for IP address
    // Add any other common parameters here if needed
  };

  switch (eventType) {
    case 'warning':
      emailSentLocalStorageKey = `maliciousWarningSent_${userEmail}`;
      subjectForLogging = '🚨 Security Alert: Multiple Failed Login Attempts';
      templateIdToSend = EMAILJS_WARNING_TEMPLATE_ID;
      break;
    case 'blocked':
      emailSentLocalStorageKey = `blockedAccountEmailSent_${userEmail}`;
      subjectForLogging = '⛔ Account Blocked for Security Reasons';
      templateIdToSend = EMAILJS_BLOCKED_TEMPLATE_ID;
      break;
    default:
      console.error("❌ Invalid email event type provided:", eventType);
      return;
  }

  // Prevent duplicate emails for this user/event type in the browser
  if (getEmailSentFlag(emailSentLocalStorageKey)) {
    console.log(`📧 Email '${subjectForLogging}' already sent to ${userEmail} (persisted).`);
    return;
  }

  try {
    // Check if the service ID or template ID are missing before sending
    if (!EMAILJS_SERVICE_ID || !templateIdToSend) {
      console.error("❌ EmailJS Service ID or the specific Template ID is missing. Please check your .env file.");
      return;
    }

    await emailjs.send(EMAILJS_SERVICE_ID, templateIdToSend, params);
    console.log(`✅ Email '${subjectForLogging}' sent successfully to ${userEmail}!`);
    setEmailSentFlag(emailSentLocalStorageKey, 'true'); // Mark as sent
  } catch (error) {
    console.error(`❗ Failed to send email '${subjectForLogging}' to ${userEmail}:`, error);
  }
};

/**
 * Resets the email sent flags for a specific user in localStorage.
 * Call this on successful login to allow future warnings/blocks.
 *
 * @param {string} userEmail - The user's email address.
 */
export const resetEmailSentFlags = (userEmail) => {
  localStorage.removeItem(`maliciousWarningSent_${userEmail}`);
  localStorage.removeItem(`blockedAccountEmailSent_${userEmail}`);
  console.log(`🔄 Email sent flags reset for ${userEmail}.`);
};
