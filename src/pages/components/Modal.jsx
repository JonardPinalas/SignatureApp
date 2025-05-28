const Modal = ({ show, onClose, children }) => {
  if (!show) {
    return null;
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button style={modalStyles.closeButton} onClick={onClose}>
          &times;
        </button>
        {children}
      </div>
    </div>
  );
};

const modalStyles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "var(--brand-card)",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.25)",
    position: "relative",
    minWidth: "350px",
    maxWidth: "500px",
    width: "90%",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  closeButton: {
    position: "absolute",
    top: "15px",
    right: "15px",
    background: "none",
    border: "none",
    fontSize: "1.8em",
    color: "var(--brand-text-light)",
    cursor: "pointer",
    transition: "color 0.2s ease",
    "&:hover": {
      color: "var(--brand-heading)",
    },
  },
};

export default Modal;
