export interface KeyboardEventHandlers {
  onToggleOverlay: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onSelect: () => void;
  onBack: () => void;
  onClose: () => void;
}

export class KeyboardManager {
  private static instance: KeyboardManager;
  private handlers: KeyboardEventHandlers | null = null;
  private toggleOverlayCallback: (() => void) | null = null;
  private isActive = false;

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public static getInstance(): KeyboardManager {
    if (!KeyboardManager.instance) {
      KeyboardManager.instance = new KeyboardManager();
    }
    return KeyboardManager.instance;
  }

  public initialize(handlers: KeyboardEventHandlers): void {
    this.handlers = handlers;
    this.attachGlobalListeners();
  }

  public onToggleOverlay(callback: () => void): void {
    this.toggleOverlayCallback = callback;
    this.attachGlobalListeners();
  }

  public setActive(active: boolean): void {
    this.isActive = active;
  }

  private attachGlobalListeners(): void {
    document.addEventListener("keydown", this.handleKeyDown, true);
  }

  public detachGlobalListeners(): void {
    document.removeEventListener("keydown", this.handleKeyDown, true);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Handle CMD+/ (or Ctrl+/ on non-Mac) for overlay toggle
    if ((event.metaKey || event.ctrlKey) && event.key === "/") {
      event.preventDefault();
      event.stopPropagation();

      // Use toggle callback if available (content script mode)
      if (this.toggleOverlayCallback) {
        this.toggleOverlayCallback();
        return;
      }

      // Use handlers if available (component mode)
      if (this.handlers) {
        this.handlers.onToggleOverlay();
        return;
      }
    }

    // Only handle other keys when overlay is active and handlers are available
    if (!this.isActive || !this.handlers) return;

    // Don't intercept keys when user is typing in input elements, except for Escape
    const target = event.target as HTMLElement;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA") && event.key !== "Escape") {
      return;
    }

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        event.stopPropagation();
        this.handlers.onNavigateUp();
        break;

      case "ArrowDown":
        event.preventDefault();
        event.stopPropagation();
        this.handlers.onNavigateDown();
        break;

      case "Enter":
        event.preventDefault();
        event.stopPropagation();
        this.handlers.onSelect();
        break;

      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        this.handlers.onBack();
        break;

      default:
        // Let other keys pass through for search input
        break;
    }
  }

  public handleSearchKeyDown(event: React.KeyboardEvent): void {
    if (!this.handlers) return;

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        this.handlers.onNavigateUp();
        break;

      case "ArrowDown":
        event.preventDefault();
        this.handlers.onNavigateDown();
        break;

      case "Enter":
        event.preventDefault();
        this.handlers.onSelect();
        break;

      case "Escape":
        event.preventDefault();
        this.handlers.onBack();
        break;

      default:
        // Allow normal typing in search field
        break;
    }
  }

  public cleanup(): void {
    this.detachGlobalListeners();
    this.handlers = null;
    this.toggleOverlayCallback = null;
    this.isActive = false;
  }

  public destroy(): void {
    this.cleanup();
  }
}
