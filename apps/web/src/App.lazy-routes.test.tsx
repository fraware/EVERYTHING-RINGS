import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AtlasApp } from "./AtlasApp";
import { TwinLabApp } from "./TwinLabApp";

describe("research lab copy", () => {
  it("states Twin results are synthetic and not physical identity", () => {
    const html = renderToStaticMarkup(<TwinLabApp />);
    expect(html).toContain("Every result on this page is synthetic");
    expect(html).toContain("not a network");
    expect(html).toContain("not the probability that two physical objects are the same");
  });

  it("states Atlas is local, PCM-free, and not a same-object network", () => {
    const html = renderToStaticMarkup(<AtlasApp />);
    expect(html).toContain("not a Resonance Atlas network");
    expect(html).toContain("not the same physical object");
    expect(html).toContain("PREVIEW PUBLICATION METADATA");
    expect(html).toContain("included in a set");
    expect(html).toContain("Raw microphone samples stay on device by default");
  });
});
