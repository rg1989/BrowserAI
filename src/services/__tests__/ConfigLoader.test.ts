import { ConfigLoader } from "../ConfigLoader";
import { createDefaultConfig } from "../../utils/validation";

describe("ConfigLoader", () => {
  let configLoader: ConfigLoader;

  beforeEach(() => {
    configLoader = ConfigLoader.getInstance();
    configLoader.clearCache();
    jest.clearAllMocks();
  });

  it("should return singleton instance", () => {
    const instance1 = ConfigLoader.getInstance();
    const instance2 = ConfigLoader.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should load default config when no stored config exists", async () => {
    const mockGet = jest.fn().mockResolvedValue({});
    global.chrome.storage.local.get = mockGet;

    const config = await configLoader.loadConfig();

    expect(config).toEqual(createDefaultConfig());
    expect(mockGet).toHaveBeenCalledWith(["workflowConfig"]);
  });

  it("should load stored config when available", async () => {
    const storedConfig = createDefaultConfig();
    const mockGet = jest
      .fn()
      .mockResolvedValue({ workflowConfig: storedConfig });
    global.chrome.storage.local.get = mockGet;

    const config = await configLoader.loadConfig();

    expect(config).toEqual(storedConfig);
  });

  it("should update and save config", async () => {
    const mockSet = jest.fn().mockResolvedValue(undefined);
    global.chrome.storage.local.set = mockSet;

    const newConfig = createDefaultConfig();
    await configLoader.updateConfig(newConfig);

    expect(mockSet).toHaveBeenCalledWith({ workflowConfig: newConfig });
    expect(configLoader.getConfig()).toEqual(newConfig);
  });

  it("should reject invalid config updates", async () => {
    const invalidConfig = { invalid: "config" } as any;

    await expect(configLoader.updateConfig(invalidConfig)).rejects.toThrow(
      "Invalid workflow configuration"
    );
  });
});
