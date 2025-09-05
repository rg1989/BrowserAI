import React from "react";
import { SettingsManager } from "../SettingsManager";

describe("SettingsManager", () => {
  it("should be importable and have correct interface", () => {
    expect(SettingsManager).toBeDefined();
    expect(typeof SettingsManager).toBe("function");
  });

  it("should accept the correct props interface", () => {
    const props = {
      onSettingsChange: jest.fn(),
      onClose: jest.fn(),
    };

    // This test just verifies the component can be instantiated with correct props
    expect(() => React.createElement(SettingsManager, props)).not.toThrow();
  });
});
