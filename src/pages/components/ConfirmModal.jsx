import React from "react";

const ConfirmModal = ({ show, onClose, onConfirm, message, confirmText = "Confirm", cancelText = "Cancel" }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-brand-card p-6 rounded-lg shadow-xl text-center max-w-sm mx-auto border border-brand-border">
        <p className="text-lg font-semibold mb-6 text-brand-heading">{message}</p>
        <div className="flex justify-center space-x-4">
          <button onClick={onConfirm} className="px-5 py-2 bg-color-error text-white rounded-md hover:bg-color-error-hover transition-colors duration-200">
            {confirmText}
          </button>
          <button onClick={onClose} className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200">
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
