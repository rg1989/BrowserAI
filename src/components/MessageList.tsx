import React from "react";
import { ChatMessage } from "../types/workflow";
import "./MessageList.css";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
}) => {
  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="message-list-empty">
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <div className="empty-text">Start a conversation</div>
          <div className="empty-subtext">
            Type a message below to get started
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${
            message.sender === "user" ? "message-user" : "message-ai"
          }`}
        >
          <div className="message-content">
            <div className="message-text">{message.content}</div>
            <div className="message-time">{formatTime(message.timestamp)}</div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="message message-ai">
          <div className="message-content">
            <div className="message-loading">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
