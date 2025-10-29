// src/components/ui/form-elements.tsx
import { forwardRef } from 'react';

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${className}`}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${className}`}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white ${className}`}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export const Checkbox = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded ${className}`}
      ref={ref}
      {...props}
    />
  );
});
Checkbox.displayName = 'Checkbox';

export const RadioGroup = ({
  name,
  value,
  onChange,
  children,
  required
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children: React.ReactNode;
  required?: boolean;
}) => {
  return (
    <div className="space-y-2">
      {children}
      <input type="hidden" name={name} value={value} required={required} />
    </div>
  );
};

export const RadioItem = ({
  value,
  label,
  name
}: {
  value: string;
  label: string;
  name?: string;
}) => {
  return (
    <div className="flex items-center">
      <input
        id={`radio-${value}`}
        type="radio"
        name={name}
        value={value}
        className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
      />
      <label htmlFor={`radio-${value}`} className="ml-3 text-sm text-gray-700">
        {label}
      </label>
    </div>
  );
};