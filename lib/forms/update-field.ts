import type { ChangeEvent, Dispatch, SetStateAction } from "react";

export function updateField<T extends Record<string, string>>(
  setFields: Dispatch<SetStateAction<T>>,
  name: keyof T & string,
) {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFields((prev) => ({ ...prev, [name]: value }));
  };
}
