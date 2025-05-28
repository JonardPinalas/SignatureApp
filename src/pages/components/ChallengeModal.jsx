import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient"; // Adjust path as needed
import Modal from "./Modal"; // Assuming you have a generic Modal component

const ChallengeModal = ({ show, onClose, onVerified, requiredFactors = ["totp"] }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [challengeMethod, setChallengeMethod] = useState(""); // e.g., 'totp'
  const [totpCode, setTotpCode] = useState("");
  const [verifiedFactorId, setVerifiedFactorId] = useState(null); // Stores the ID of the verified factor

  // Effect to determine challenge method and reset state when modal opens
  useEffect(() => {
    if (!show) {
      // Reset all states when modal is closed
      setLoading(false);
      setError("");
      setChallengeMethod("");
      setTotpCode("");
      setVerifiedFactorId(null);
      return;
    }

    const checkMFAEnrollment = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;

        const verifiedTotpFactor = data.totp?.find((f) => f.status === "verified");

        // Prioritize TOTP if required and available
        if (requiredFactors.includes("totp") && verifiedTotpFactor) {
          setChallengeMethod("totp");
          setVerifiedFactorId(verifiedTotpFactor.id); // Store for verification
        } else {
          // If no required factors are found or verified, assume direct verification is not possible via MFA
          // You might want to handle this differently, e.g., show an error or disallow the action
          setError("No verified MFA factor found for challenge. Please enable 2FA on your profile.");
          setChallengeMethod(null); // No valid challenge method
        }
      } catch (err) {
        console.error("Error listing MFA factors:", err);
        setError("Failed to determine 2FA method. Please try again.");
        setChallengeMethod(null);
      } finally {
        setLoading(false);
      }
    };

    checkMFAEnrollment();
  }, [show, requiredFactors]);

  const handleVerifyTotp = async () => {
    setError("");
    if (!totpCode || totpCode.length !== 6) {
      // Assuming 6-digit TOTP
      setError("Please enter a valid 6-digit TOTP code.");
      return;
    }
    if (!verifiedFactorId) {
      setError("No active TOTP factor found for verification.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: verifiedFactorId,
        code: totpCode,
      });

      if (verifyError) {
        console.error("TOTP verification failed:", verifyError);
        setError(verifyError.message || "Invalid TOTP code. Please try again.");
      } else if (data) {
        // Verification successful
        onVerified(data.session); // Pass the new session to the parent
        onClose(); // Close the modal
      } else {
        setError("Unknown error during verification.");
      }
    } catch (err) {
      console.error("Unexpected error during TOTP verification:", err);
      setError("An unexpected error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(""); // Clear error on close
    setTotpCode(""); // Clear code on close
    onClose();
  };

  return (
    <Modal show={show} onClose={handleClose}>
      <h3 className="text-2xl font-semibold text-brand-heading mb-4 text-center">Action Requires Verification</h3>

      {loading && <p className="text-center text-brand-text-light">Loading verification methods...</p>}
      {error && <p className="text-color-error-text bg-color-error-bg p-3 rounded-md text-sm mb-4">{error}</p>}

      {!loading && challengeMethod === "totp" && (
        <div className="space-y-4">
          <p className="text-brand-text text-center">Please enter the 6-digit code from your authenticator app.</p>
          <input
            type="text"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.trim())}
            placeholder="Authenticator code"
            maxLength={6}
            className="w-full p-3 rounded-md border border-brand-border bg-brand-card text-brand-text placeholder-brand-text-light focus:outline-none focus:ring-2 focus:ring-color-button-primary text-center text-xl tracking-widest"
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={loading}
          />
          <div className="flex justify-center gap-4 mt-6">
            <button onClick={handleClose} disabled={loading} className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={handleVerifyTotp}
              disabled={loading || !totpCode || totpCode.length !== 6}
              className="px-6 py-2 bg-color-button-primary text-white rounded-md hover:bg-color-button-primary-hover transition-colors disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        </div>
      )}

      {!loading && !challengeMethod && !error && <p className="text-center text-brand-text">No suitable 2FA method found or enabled. Please enable 2FA in your profile to perform this action.</p>}
    </Modal>
  );
};

export default ChallengeModal;
