"use client";

import { useState } from "react";
import { updateStoreRecord } from "@/lib/actions/admin";
import { IdCardCapture } from "@/components/id-card-capture";
import { Button } from "@/components/ui";

export function StoreIdentityForm({
  merchantId,
  cnicNumber,
}: {
  merchantId: string;
  cnicNumber: string;
}) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);

  async function submit(formData: FormData) {
    if (front) formData.set("cnicImageFront", front);
    if (back) formData.set("cnicImageBack", back);
    await updateStoreRecord(formData);
  }

  return (
    <form action={submit} className="mt-4 space-y-3">
      <input type="hidden" name="merchantId" value={merchantId} />
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">ID number</span>
        <input
          name="cnicNumber"
          defaultValue={cnicNumber}
          placeholder="35202-1234567-1"
          className="h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      <IdCardCapture label="Replace front" onFile={setFront} />
      <IdCardCapture label="Replace back" onFile={setBack} />
      <Button type="submit">Save identity fields</Button>
    </form>
  );
}
