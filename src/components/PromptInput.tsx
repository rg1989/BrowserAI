import React, { useRef, useEffect } from "react";
import "./PromptInput.css";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  placeholder: string;
  disabled: boolean;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus when component mounts
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    // Auto-resize textarea based on content
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value);
    }
  };

  return (
    <div className="prompt-input">
      <div className="prompt-input-container">
        <textarea
          ref={textareaRef}
          className="prompt-textarea"
          data-testid="prompt-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          maxLength={2000}
        />
        <button
          className={`prompt-send-button ${
            value.trim() && !disabled ? "prompt-send-button-active" : ""
          }`}
          data-testid="send-button"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor" />
          </svg>
        </button>
      </div>
      <div className="prompt-hint">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
};
