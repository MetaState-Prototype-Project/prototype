import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CustomNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onChange?: (value: string) => void;
}

const CustomNumberInput = forwardRef<HTMLInputElement, CustomNumberInputProps>(
  ({ className, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      // Strip commas from pasted values
      value = value.replace(/,/g, '');
      // Allow only numbers, decimal point, and empty string
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        onChange?.(value);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      // Strip commas and validate
      const cleaned = pastedText.replace(/,/g, '').replace(/[^\d.]/g, '');
      // Only allow one decimal point
      const parts = cleaned.split('.');
      const sanitized = parts.length > 2 
        ? parts[0] + '.' + parts.slice(1).join('')
        : cleaned;
      
      if (sanitized === "" || /^\d*\.?\d*$/.test(sanitized)) {
        onChange?.(sanitized);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const key = e.key;

      // Allow navigation and control keys
      if (
        key === 'Backspace' ||
        key === 'Delete' ||
        key === 'Tab' ||
        key === 'Escape' ||
        key === 'Enter' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'Home' ||
        key === 'End' ||
        key === '.' ||
        key === ',' // Allow comma for international keyboards
      ) {
        return;
      }

      // Allow Ctrl/Cmd combinations (copy, paste, cut, select all, undo, redo)
      if (e.ctrlKey || e.metaKey) {
        return;
      }

      // Only allow numeric keys (let handleChange do the validation)
      if (!/^\d$/.test(key)) {
        e.preventDefault();
      }
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn(className)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        {...props}
      />
    );
  }
);

CustomNumberInput.displayName = "CustomNumberInput";

export default CustomNumberInput;

