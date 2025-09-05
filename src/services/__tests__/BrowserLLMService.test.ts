import { BrowserLLMService } from "../BrowserLLMService";

describe("BrowserLLMService", () => {
  it("should create instance", () => {
    const service = new BrowserLLMService();
    expect(service).toBeInstanceOf(BrowserLLMService);
  });

  it("should return service info", () => {
    const service = new BrowserLLMService();
    const info = service.getServiceInfo();
    expect(info.name).toBe("Browser LLM Service");
  });

  it("should list available models", () => {
    const models = BrowserLLMService.getAvailableModels();
    expect(models.length).toBe(3);
  });
});
