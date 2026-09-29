"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useStudio } from "@/store/useStudio";

export function Toast() {
  const toast = useStudio((s) => s.toast);
  const dismiss = useStudio((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, toast.action ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-strong pointer-events-auto flex max-w-md items-center gap-3 rounded-xl p-2 pr-2 shadow-xl shadow-black/40"
          >
            {toast.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={toast.thumb} alt="" className="h-9 w-12 shrink-0 rounded-md object-cover" />
            )}
            <span className="min-w-0 flex-1 px-1 text-sm">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.run();
                  dismiss();
                }}
                className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg"
              >
                {toast.action.label}
              </button>
            )}
            <button onClick={dismiss} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:text-fg">
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
