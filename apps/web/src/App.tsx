import { AtlasApp } from "./AtlasApp";
import { CampaignAuthorApp } from "./CampaignAuthorApp";
import { CampaignCollectionApp } from "./CampaignCollectionApp";
import { ConsumerApp } from "./ConsumerApp";
import { LabApp } from "./LabApp";
import { PostCollectionReviewApp } from "./PostCollectionReviewApp";
import { ReleaseApp } from "./ReleaseApp";
import { TwinLabApp } from "./TwinLabApp";
import "./postCollectionReview.css";

export function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("release") === "1") return <ReleaseApp />;
  if (params.get("gate-b") === "1") return <PostCollectionReviewApp mode="gate-b" />;
  if (params.get("gate-c") === "1") return <PostCollectionReviewApp mode="gate-c" />;
  if (params.get("campaign-author") === "1") return <CampaignAuthorApp />;
  if (params.get("campaign") === "1") return <CampaignCollectionApp />;
  if (params.get("twin") === "1") return <TwinLabApp />;
  if (params.get("atlas") === "1") return <AtlasApp />;
  if (params.get("lab") === "1") return <LabApp />;
  return <ConsumerApp />;
}
