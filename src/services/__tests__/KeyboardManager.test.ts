import { KeyboardManager, KeyboardEventHandlers } from "../KeyboardManager";

describe("KeyboardManager", () => {
  let keyboardManager: KeyboardManager;
  let mockHandlers: jest.Mocked<KeyboardEventHandlers>;

  beforeEach(() => {
    keyboardManager = KeyboardManager.getInstance();
    mockHandlers = {
      onToggleOverlay: jest.fn(),
      onNavigateUp: jest.fn(),
      onNavigateDown: jest.fn(),
      onSelect: jest.fn(),
      onBack: jest.fn(),
      onClose: jest.fn(),
    };
    keyboardManager.initialize(mockHandlers);
  });

  afterEach(() => {
    keyboardManager.destroy();
    jest.clearAllMocks();
  });

  it("should handle CMD+/ to toggle overlay", () => {
    const event = new KeyboardEvent("keydown", {
      key: "/",
      metaKey: true,
    });

    document.dispatchEvent(event);

    expect(mockHandlers.onToggleOverlay).toHaveBeenCalled();
  });

  it("should handle Ctrl+/ to toggle overlay on non-Mac", () => {
    const event = new KeyboardEvent("keydown", {
      key: "/",
      ctrlKey: true,
    });

    document.dispatchEvent(event);

    expect(mockHandlers.onToggleOverlay).toHaveBeenCalled();
  });

  it("should handle arrow keys when active", () => {
    keyboardManager.setActive(true);

    // Test ArrowUp
    const upEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
    document.dispatchEvent(upEvent);
    expect(mockHandlers.onNavigateUp).toHaveBeenCalled();

    // Test ArrowDown
    const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
    document.dispatchEvent(downEvent);
    expect(mockHandlers.onNavigateDown).toHaveBeenCalled();
  });

  it("should handle Enter key when active", () => {
    keyboardManager.setActive(true);

    const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
    document.dispatchEvent(enterEvent);

    expect(mockHandlers.onSelect).toHaveBeenCalled();
  });

  it("should handle Escape key when active", () => {
    keyboardManager.setActive(true);

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(escapeEvent);

    expect(mockHandlers.onBack).toHaveBeenCalled();
  });

  it("should not handle navigation keys when inactive", () => {
    keyboardManager.setActive(false);

    const upEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
    document.dispatchEvent(upEvent);

    expect(mockHandlers.onNavigateUp).not.toHaveBeenCalled();
  });

  it("should handle search field key events", () => {
    const mockEvent = {
      key: "ArrowUp",
      preventDefault: jest.fn(),
    } as any;

    keyboardManager.handleSearchKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockHandlers.onNavigateUp).toHaveBeenCalled();
  });
});
