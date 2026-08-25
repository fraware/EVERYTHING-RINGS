import { lazy, Suspense, type ReactElement } from "react";
import { ConsumerApp } from "./ConsumerApp";

const ReleaseRoute = lazy(() => import("./research/ReleaseRoute"));
const GateReviewRoute = lazy(() => import("./research/GateReviewRoute"));
const CampaignAuthorRoute = lazy(() => import("./research/CampaignAuthorRoute"));
const CampaignCollectionRoute = lazy(() => import("./research/CampaignCollectionRoute"));
const TwinLabRoute = lazy(() => import("./research/TwinLabRoute"));
const AtlasLabRoute = lazy(() => import("./research/AtlasLabRoute"));
const LabRoute = lazy(() => import("./research/LabRoute"));

function ResearchFallback() {
  return <main className="shell"><p className="lede">Loading lab surface…</p></main>;
}

function research(element: ReactElement) {
  return <Suspense fallback={<ResearchFallback />}>{element}</Suspense>;
}

export function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("release") === "1") return research(<ReleaseRoute />);
  if (params.get("gate-b") === "1") return research(<GateReviewRoute mode="gate-b" />);
  if (params.get("gate-c") === "1") return research(<GateReviewRoute mode="gate-c" />);
  if (params.get("campaign-author") === "1") return research(<CampaignAuthorRoute />);
  if (params.get("campaign") === "1") return research(<CampaignCollectionRoute />);
  if (params.get("twin") === "1") return research(<TwinLabRoute />);
  if (params.get("atlas") === "1") return research(<AtlasLabRoute />);
  if (params.get("lab") === "1") return research(<LabRoute />);
  return <ConsumerApp />;
}
