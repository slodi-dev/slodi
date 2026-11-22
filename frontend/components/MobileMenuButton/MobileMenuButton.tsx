import React from "react";
import { Menu, X } from "lucide-react";
import styles from "./MobileMenuButton.module.css";

interface MobileMenuButtonProps {
  isOpen: boolean;
  onClick: () => void;
  /** Id of the drawer it opens. */
  controls?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

export function MobileMenuButton({ isOpen, onClick, controls, ref }: MobileMenuButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.button}
      onClick={onClick}
      aria-label={isOpen ? "Loka valmynd" : "Opna valmynd"}
      aria-expanded={isOpen}
      aria-controls={controls}
    >
      {isOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
  );
}
