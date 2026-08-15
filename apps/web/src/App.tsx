import { ConsumerApp } from "./ConsumerApp";
import { LabApp } from "./LabApp";

export function App() {
  const labMode = new URLSearchParams(window.location.search).get("lab") === "1";
  return labMode ? <LabApp /> : <ConsumerApp />;
}
