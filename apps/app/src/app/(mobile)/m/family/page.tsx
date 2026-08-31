import { Suspense } from "react";
import { FamilyPage } from "@/components/FamilyPage";

export default function MobileFamily() {
  return (
    <Suspense>
      <FamilyPage />
    </Suspense>
  );
}
