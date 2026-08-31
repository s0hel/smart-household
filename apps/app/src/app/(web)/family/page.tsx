import { Suspense } from "react";
import { FamilyPage } from "@/components/FamilyPage";

export default function Family() {
  return (
    <Suspense>
      <FamilyPage />
    </Suspense>
  );
}
