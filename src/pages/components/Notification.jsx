import React, { useEffect, useState } from "react";

const Notification = ({ message, type, onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false); // Controls actual rendering in DOM

  // Effect for showing the notification
  useEffect(() => {
    if (message) {
      setShouldRender(true); // Start rendering the component
      const showTimer = setTimeout(() => {
        setIsVisible(true); // Trigger the slide-in/fade-in animation
      }, 50); // Small delay to allow element to be in DOM before transition starts

      // Automatically hide after 'duration' milliseconds
      const hideTimer = setTimeout(() => {
        setIsVisible(false); // Trigger the slide-out/fade-out animation
      }, duration + 50); // Add a small buffer to the duration

      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      }; // Clean up timers on unmount or message change
    } else {
      // If message is cleared externally, ensure hidden and not rendered
      setIsVisible(false);
      setShouldRender(false);
    }
  }, [message, duration]);

  // Effect for unmounting after hide animation completes
  useEffect(() => {
    // Only proceed if not visible but still rendered (meaning it's animating out)
    if (!isVisible && shouldRender) {
      const unmountTimer = setTimeout(() => {
        setShouldRender(false); // Stop rendering after animation completes
        if (onClose) {
          onClose(); // Call the parent's onClose handler if provided
        }
      }, 300); // This duration should match your CSS transition duration

      return () => clearTimeout(unmountTimer);
    }
  }, [isVisible, shouldRender, onClose]);

  if (!shouldRender) {
    return null; // Don't render anything if shouldRender is false
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
      // Key changes are here: `bottom-4 right-4` for position and `translate-y-0` for entry/exit
      className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-sm w-full z-50
                  flex items-center justify-between border-l-4 transform transition-all duration-300 ease-in-out
                  ${bgColorClass} ${textColorClass} ${borderColorClass}
                  ${isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`} // Changed -translate-y-full to translate-y-full for bottom entry
    >
      <p className="flex-grow text-sm font-medium">{message}</p>
      <button
        onClick={() => setIsVisible(false)} // This will trigger the fade-out animation immediately
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
