import React, { useEffect, useRef } from "react";
import { SearchFieldProps } from "../types/workflow";
import "./SearchField.css";

export const SearchField: React.FC<SearchFieldProps> = ({
  prefix,
  value,
  onChange,
  disabled,
  placeholder,
  onKeyDown,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus when component mounts or becomes enabled
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(event.target.value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(event);
    }
  };

  return (
    <div className="search-field">
      <div className="search-field-container">
        {prefix && (
          <span className="search-field-prefix" aria-label="Breadcrumb">
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          className="search-field-input"
          data-testid="search-field"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
