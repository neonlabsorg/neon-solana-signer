import React from 'react';

interface FormInputProps {
  label: string;
  value: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onInput?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  rightLabel?: string | (() => string);
  type?: 'text' | 'number' | 'email' | 'password';
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
}

export const FormInput: React.FC<FormInputProps> = ({ label, value, onChange, onInput, disabled = false, placeholder = '', rightLabel, type = 'text', className = '', inputClassName = '', labelClassName = '', }) => {
  return (
    <div className={`${className}`}>
      <label className={`form-label flex flex-row justify-between ${labelClassName}`}>
        <span>{label}</span>
        {rightLabel && (
          <span>
            {typeof rightLabel === 'function' ? rightLabel() : rightLabel}
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onInput={onInput}
        disabled={disabled}
        placeholder={placeholder}
        className={`form-input ${inputClassName}`}
      />
    </div>
  );
};
