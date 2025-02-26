import React from 'react';

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  labelClassName?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({ label, value, onChange, options, disabled = false, className = '', selectClassName = '', labelClassName = '', }) => {
  return (
    <div className={`form-field ${className}`}>
      <label className={`form-label ${labelClassName}`}>
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`form-select ${selectClassName}`}
      >
        <option value="" disabled>Select {label}</option>
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
