import React, { useEffect, useState } from "react";

const Notification = ({ message, type, onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Set visibility to true when message is provided
  useEffect(() => {
    if (message) {
      setIsVisible(true);
      // Automatically hide after 'duration' milliseconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) {
          onClose(); // Call the parent's onClose handler
        }
      }, duration);

      return () => clearTimeout(timer); // Clean up the timer
    } else {
      setIsVisible(false);
    }
  }, [message, duration, onClose]);

  if (!isVisible || !message) {
    return null; // Don't render if not visible or no message
  }

  // Determine styling based on message type
  let bgColorClass = "";
  let textColorClass = "";
  let borderColorClass = "";

  switch (type) {
    case "success":
      bgColorClass = "bg-green-100 dark:bg-green-900";
      textColorClass = "text-green-800 dark:text-green-200";
      borderColorClass = "border-green-400 dark:border-green-700";
      break;
    case "error":
      bgColorClass = "bg-red-100 dark:bg-red-900";
      textColorClass = "text-red-800 dark:text-red-200";
      borderColorClass = "border-red-400 dark:border-red-700";
      break;
    case "info":
    default:
      bgColorClass = "bg-blue-100 dark:bg-blue-900";
      textColorClass = "text-blue-800 dark:text-blue-200";
      borderColorClass = "border-blue-400 dark:border-blue-700";
      break;
  }

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-lg max-w-sm w-full z-50
                  flex items-center justify-between border-l-4 transform transition-all duration-300
                  ${bgColorClass} ${textColorClass} ${borderColorClass}
                  ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
    >
      <p className="flex-grow text-sm font-medium">{message}</p>
      <button
        onClick={() => setIsVisible(false)} // Allow manual close
        className={`ml-4 p-1 rounded-full ${textColorClass} hover:bg-opacity-75 transition-colors`}
        aria-label="Close notification"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};

export default Notification;
