import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible label for the dialog */
  label?: string;
}

/**
 * Right-side slide-over panel built on Radix Dialog.
 * Handles focus trap, Esc to close, body scroll lock, and
 * animated entrance/exit via CSS (respects prefers-reduced-motion).
 */
export function Sheet({ open, onClose, children, label = 'Details' }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="sheet-panel"
          aria-label={label}
          onInteractOutside={onClose}
        >
          {/* Close button — top-right corner */}
          <Dialog.Close asChild>
            <button
              className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-white/10 transition-colors"
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </Dialog.Close>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
