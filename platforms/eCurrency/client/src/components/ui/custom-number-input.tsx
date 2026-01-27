import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CustomNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onChange?: (value: string) => void;
}

const CustomNumberInput = forwardRef<HTMLInputElement, CustomNumberInputProps>(
  ({ className, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Use nativeEvent to see exactly what the user just did
      const nativeEvent = e.nativeEvent as InputEvent;
      let value = e.target.value;

      // 1. Only convert if the user EXPLICITLY typed a comma
      // nativeEvent.data is the character the user just inserted
      if (nativeEvent.data === ',' && !value.includes('.')) {
        // If they typed a comma, treat it as a decimal point
        value = value.replace(/,$/, '.');
      }

      // 2. Now strip ALL commas (thousand separators)
      // This is safe because if the user typed a comma, it was converted 
      // to a dot above. If the comma was from formatting, it gets removed here.
      const cleanValue = value.replace(/,/g, '');

      // 3. Validation
      if (cleanValue === "" || /^\d*\.?\d*$/.test(cleanValue)) {
        onChange?.(cleanValue);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      let cleaned = pastedText.trim();

      const hasDot = cleaned.includes('.');
      const hasComma = cleaned.includes(',');

      if (hasDot && hasComma) {
        // Use the last separator as decimal, strip the other as thousands
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        if (lastDot > lastComma) {
          // Dot is decimal, comma is thousands: "1,234.56" → "1234.56"
          cleaned = cleaned.replace(/,/g, '');
        } else {
          // Comma is decimal, dot is thousands: "1.234,56" → "1234.56"
          cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
        }
      } else if (hasComma) {
        // Heuristic: if comma looks like thousands grouping, strip; else treat as decimal
        // "1,234" → "1234" but "12,5" → "12.5"
        cleaned = /,\d{3}(?!\d)/.test(cleaned) ? cleaned.replace(/,/g, '') : cleaned.replace(/,/g, '.');
      }

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

