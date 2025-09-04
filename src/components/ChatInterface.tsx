import React, { useState, useRef, useEffect } from "react";
import { ChatInterfaceProps, ChatMessage } from "../types/workflow";
import { MessageList } from "./MessageList";
import { PromptInput } from "./PromptInput";
import "./ChatInterface.css";

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  workflowType,
  onSendMessage,
  messages: initialMessages = [],
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Call the parent's onSendMessage handler
      await onSendMessage(message.trim());

      // Simulate AI response (in real implementation, this would come from the parent)
      setTimeout(() => {
        const aiResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: `This is a mock response from ${workflowType}. In a real implementation, this would be connected to an AI service.`,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsLoading(false);
    }
  };

  const getPlaceholder = () => {
    switch (workflowType) {
      case "ai-ask":
        return "Ask me anything...";
      case "ai-agent":
        return "What would you like me to help you with?";
      default:
        return "Type your message...";
    }
  };

  return (
    <div className="chat-interface" data-testid="chat-interface">
      <div className="chat-header">
        <h3 className="chat-title">
          {workflowType === "ai-ask" ? "AI Ask" : "AI Agent"}
        </h3>
        <div className="chat-subtitle">
          {workflowType === "ai-ask"
            ? "Ask questions and get instant answers"
            : "Get help with tasks and workflows"}
        </div>
      </div>

      <div className="chat-messages">
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <PromptInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          placeholder={getPlaceholder()}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};
