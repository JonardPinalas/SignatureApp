// src/components/TOTPEnrollmentModal.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient"; // Adjust path if needed
import Modal from "./Modal"; // Assuming you have a Modal component

const TOTPEnrollmentModal = ({ show, onClose, onEnrolled }) => {
  const [factorId, setFactorId] = useState("");
  const [qr, setQR] = useState(""); // holds the QR code image SVG
  const [verifyCode, setVerifyCode] = useState(""); // contains the code entered by the user
  const [error, setError] = useState(""); // holds an error message
  const [loading, setLoading] = useState(true); // Initial loading for enrollment
  const [showVerificationStep, setShowVerificationStep] = useState(false); // To control UI flow

  // Effect to handle initial enrollment when modal opens
  useEffect(() => {
    if (!show) {
      // Reset all states when the modal is closed
      setFactorId("");
      setQR("");
      setVerifyCode("");
      setError("");
      setLoading(true); // Reset loading for next open
      setShowVerificationStep(false);
      return;
    }

    const startEnrollment = async () => {
      setLoading(true);
      setError("");

      try {
        // Step 1: Check if a TOTP factor is already enabled
        const { data: listFactorsData, error: listFactorsError } = await supabase.auth.mfa.listFactors();

        if (listFactorsError) {
          throw listFactorsError;
        }

        const existingTotpFactor = listFactorsData?.factors?.find((f) => f.factor_type === "totp" && f.status === "verified");

        if (existingTotpFactor) {
          setError("You already have a verified TOTP factor. Please disable it first.");
          setLoading(false);
          // Optionally, you might want to call onClose() here if you don't want to show the modal
          // if 2FA is already enabled.
          return;
        }

        // Step 2: Enroll a new TOTP factor
        const friendlyName = `TOTP-${Date.now()}`; // Unique friendly name
        const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName,
        });

        if (enrollError) {
          throw enrollError;
        }

        setFactorId(enrollData.id);
        setQR(enrollData.totp.qr_code);
        setShowVerificationStep(true); // Move to the verification step
      } catch (err) {
        console.error("2FA Enrollment Error:", err);
        setError(err.message || "Failed to start 2FA enrollment. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    startEnrollment();
  }, [show]); // Only re-run when the modal's 'show' prop changes

  // Handler for the "Enable" button (Challenge and Verify)
  const handleVerify = async () => {
    setError("");
    if (!verifyCode) {
      setError("Please enter the 6-digit code.");
      return;
    }
    if (!factorId) {
      setError("Enrollment not started. Please close and reopen the modal.");
      return;
    }

    setLoading(true);

    try {
      // Step 3: Challenge the factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        throw challengeError;
      }

      const challengeId = challengeData.id;

      // Step 4: Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: verifyCode,
      });

      if (verifyError) {
        throw verifyError;
      }

      // If verification succeeds, notify parent and close modal
      onEnrolled && onEnrolled(); // onEnrolled does not need factorId from the docs
      onClose(); // Close modal
      alert("Two-factor authentication enabled successfully!");
    } catch (err) {
      console.error("2FA Verification Error:", err);
      setError(err.message || "Verification failed. Check your code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAndReset = () => {
    onClose(); // Calls the parent's onClose, which in turn resets this modal's state via useEffect
  };

  return (
    <Modal show={show} onClose={handleCloseAndReset}>
      <h3>Set Up 2FA</h3>

      {loading && !error && <p>Loading QR code and preparing for enrollment...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && showVerificationStep && qr && (
        <>
          <p>Scan this QR code with your authenticator app.</p>
          <div style={{ textAlign: "center", margin: "15px 0" }}>
            <img src={qr} alt="QR Code" style={{ maxWidth: "200px", height: "auto", border: "1px solid #eee" }} />
          </div>

          <p>Alternatively, manually input the secret:</p>
          <input
            type="text"
            value={qr.split("secret=")[1]?.split("&")[0] || "Loading..."} // Extract secret from QR URI
            readOnly
            style={{ width: "100%", padding: "8px", margin: "10px 0", textAlign: "center", background: "#f0f0f0", border: "1px dashed #ccc" }}
          />

          <p>Enter the 6-digit code from your app:</p>
          <input
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").substring(0, 6))}
            placeholder="______"
            maxLength="6"
            style={{ width: "100%", padding: "8px", margin: "10px 0", textAlign: "center" }}
            disabled={loading}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={handleCloseAndReset} disabled={loading} style={{ padding: "8px 15px" }}>
              Cancel
            </button>
            <button onClick={handleVerify} disabled={loading || verifyCode.length !== 6} style={{ padding: "8px 15px", background: "#007bff", color: "white" }}>
              {loading ? "Verifying..." : "Enable 2FA"}
            </button>
          </div>
        </>
      )}
      {!loading && !error && !showVerificationStep && !qr && <p>Failed to load 2FA enrollment. Please try again or contact support.</p>}
    </Modal>
  );
};

export default TOTPEnrollmentModal;
