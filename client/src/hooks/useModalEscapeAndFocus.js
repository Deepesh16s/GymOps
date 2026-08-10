import { useEffect, useRef } from "react";

export default function useModalEscapeAndFocus(isOpen, onClose) {
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    triggerRef.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (triggerRef.current && typeof triggerRef.current.focus === "function") {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);
}
