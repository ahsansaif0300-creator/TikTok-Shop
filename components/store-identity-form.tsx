import { updateStoreRecord } from "@/lib/actions/admin";
import { Button } from "@/components/ui";

export function StoreIdentityForm({
  merchantId,
  cnicNumber,
  city,
  phone,
  llcCode,
}: {
  merchantId: string;
  cnicNumber: string;
  city: string;
  phone: string;
  llcCode: string;
}) {
  return (
    <form action={updateStoreRecord} className="mt-4 space-y-3">
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
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">City</span>
        <input name="city" defaultValue={city} className="h-11 w-full rounded-xl border border-line px-3" />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Phone</span>
        <input name="phone" defaultValue={phone} className="h-11 w-full rounded-xl border border-line px-3" />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">LLC code</span>
        <input
          name="llcCode"
          defaultValue={llcCode}
          placeholder="19935858"
          className="h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Replace front</span>
        <input type="file" name="cnicImageFront" accept="image/jpeg,image/png,image/webp" />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Replace back</span>
        <input type="file" name="cnicImageBack" accept="image/jpeg,image/png,image/webp" />
      </label>
      <Button type="submit">Save identity fields</Button>
    </form>
  );
}
