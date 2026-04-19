"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

let setGlobalToasts: React.Dispatch<React.SetStateAction<Toast[]>>;

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // Set global setter
    setGlobalToasts = setToasts;
  }, []);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={`px-4 py-2 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-green-500 text-white"
                : toast.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-gray-800 text-white"
            }`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Helper function to add toasts from anywhere
export function addToast(message: string, type: Toast["type"] = "info") {
  const id = Math.random().toString(36).substring(2, 10);
  const newToast: Toast = { id, message, type };

  if (setGlobalToasts) {
    setGlobalToasts((prev) => [...prev, newToast]);

    // Auto remove after 3 seconds
    setTimeout(() => {
      setGlobalToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }
}
