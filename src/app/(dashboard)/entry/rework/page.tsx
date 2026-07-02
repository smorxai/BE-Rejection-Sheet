import { Suspense } from "react";
import { ReworkEntryForm } from "@/components/forms/ReworkEntryForm";

export default function ReworkEntryPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <ReworkEntryForm />
      </Suspense>
    </div>
  );
}
