import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchField } from "../SearchField";

describe("SearchField", () => {
  const defaultProps = {
    prefix: "",
    value: "",
    onChange: jest.fn(),
    disabled: false,
    placeholder: "Search...",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with placeholder", () => {
    render(<SearchField {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search...");
    expect(input).toBeInTheDocument();
  });

  it("displays prefix when provided", () => {
    render(<SearchField {...defaultProps} prefix="AI Ask:" />);

    expect(screen.getByText("AI Ask:")).toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    const mockOnChange = jest.fn();

    render(<SearchField {...defaultProps} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Search...");
    await user.type(input, "test");

    expect(mockOnChange).toHaveBeenCalledWith("t");
    expect(mockOnChange).toHaveBeenCalledWith("e");
    expect(mockOnChange).toHaveBeenCalledWith("s");
    expect(mockOnChange).toHaveBeenCalledWith("t");
  });

  it("does not call onChange when disabled", async () => {
    const user = userEvent.setup();
    const mockOnChange = jest.fn();

    render(
      <SearchField {...defaultProps} onChange={mockOnChange} disabled={true} />
    );

    const input = screen.getByPlaceholderText("Search...");
    await user.type(input, "test");

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("calls onKeyDown when provided", () => {
    const mockOnKeyDown = jest.fn();

    render(<SearchField {...defaultProps} onKeyDown={mockOnKeyDown} />);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnKeyDown).toHaveBeenCalled();
  });

  it("auto-focuses when not disabled", () => {
    render(<SearchField {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search...");
    expect(input).toHaveFocus();
  });

  it("does not auto-focus when disabled", () => {
    render(<SearchField {...defaultProps} disabled={true} />);

    const input = screen.getByPlaceholderText("Search...");
    expect(input).not.toHaveFocus();
  });

  it("displays current value", () => {
    render(<SearchField {...defaultProps} value="current value" />);

    const input = screen.getByDisplayValue("current value");
    expect(input).toBeInTheDocument();
  });
});
