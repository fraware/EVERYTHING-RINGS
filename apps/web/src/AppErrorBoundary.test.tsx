import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppFailureFallback } from "./AppErrorBoundary";

describe("app failure fallback", () => {
  it("gives the user a clear recovery action instead of a blank page", () => {
    const html = renderToStaticMarkup(<AppFailureFallback onReload={vi.fn()} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("unexpected browser error");
    expect(html).toContain("RELOAD");
    expect(html).toContain("No microphone recording has been uploaded");
  });
});
