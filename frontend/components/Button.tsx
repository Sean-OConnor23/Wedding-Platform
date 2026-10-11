// src/components/ui/Button.tsx
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "block";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  children,
  className = "",
  ...props
}) => {
  const variantStyles = {
    /* Primary action buttons are now unified with your warm amber wedding palette */
    primary: "bg-amber-800 hover:bg-amber-900 text-white px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all duration-200 shadow-xs hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    
    /* Secondary actions use a clean, subtle outline border that matches any view background */
    secondary: "text-center py-2.5 px-6 text-xs font-semibold border border-stone-200 rounded-xl bg-white text-stone-600 hover:text-stone-900 hover:border-stone-400 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    
    /* Block buttons now scale to full width while keeping the exact same premium brand coloring */
    block: "w-full py-3.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold tracking-widest uppercase transition-all duration-200 shadow-sm hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
  };

  return (
    <button
      className={`${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
