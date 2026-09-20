import { redirect } from "next/navigation";

/** The old "human attention" list became the Inbox. */
export default function AttentionPage() {
  redirect("/inbox");
}
