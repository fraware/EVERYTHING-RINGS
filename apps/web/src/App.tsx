import { ConsumerApp } from "./ConsumerApp";
import { LabApp } from "./LabApp";
import { ReleaseApp } from "./ReleaseApp";

export function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("release") === "1") return <ReleaseApp />;
  if (params.get("lab") === "1") return <LabApp />;
  return <ConsumerApp />;
}
