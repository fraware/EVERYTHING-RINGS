import "../campaign.css";
import "../campaignCollection.css";
import "../postCollectionReview.css";
import { PostCollectionReviewApp } from "../PostCollectionReviewApp";

export default function GateReviewRoute({ mode }: { readonly mode: "gate-b" | "gate-c" }) {
  return <PostCollectionReviewApp mode={mode} />;
}
