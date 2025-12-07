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
      // Allow: backspace, delete, tab, escape, enter, decimal point
      if (
        [8, 9, 27, 13, 46, 110, 190].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)
      ) {
        return;
      }
      // Ensure that it is a number and stop the keypress
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
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

