"use client";

import type { FocusEventHandler, InputHTMLAttributes } from "react";
import { formatFieldValue, type FieldFormat } from "@/lib/form-validation";

type FormattedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue"> & {
  format: FieldFormat;
  defaultValue?: string | number | null;
};

export function FormattedInput({ format, defaultValue, onBlur, ...props }: FormattedInputProps) {
  const initialValue = defaultValue == null ? "" : formatFieldValue(String(defaultValue), format);
  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    event.currentTarget.value = formatFieldValue(event.currentTarget.value, format);
    onBlur?.(event);
  };

  return <input {...props} defaultValue={initialValue} onBlur={handleBlur} />;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span id={id} role="alert" className="mt-1 block text-xs font-normal text-red-700">{message}</span>;
}
