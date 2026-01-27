import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CustomNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onChange?: (value: string) => void;
}

const CustomNumberInput = forwardRef<HTMLInputElement, CustomNumberInputProps>(
  ({ className, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;

      // If the last character typed is a comma, and there is no dot yet,
      // treat it as a decimal separator (international keyboard support)
      if (value.endsWith(',') && !value.includes('.')) {
        value = value.slice(0, -1) + '.';
      }

      // Strip all remaining commas (which are thousand separators from formatting)
      const cleanValue = value.replace(/,/g, '');

      // Validate: allow only numbers, one decimal point, and empty string
      if (cleanValue === "" || /^\d*\.?\d*$/.test(cleanValue)) {
        onChange?.(cleanValue);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      // Replace all commas with dots (handle international formats)
      let cleaned = pastedText.replace(/,/g, '.');
      // Remove any non-numeric characters except decimal point
      cleaned = cleaned.replace(/[^\d.]/g, '');
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

