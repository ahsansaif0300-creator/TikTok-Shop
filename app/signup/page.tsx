import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { SignupForm } from "@/components/signup-form";
import { buildStamp } from "@/lib/build-stamp";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const stamp = buildStamp();

  return (
    <AuthFrame
      title="Create a TikiTok Shop"
      subtitle="You get a unique shop link and a seller login. ID photos go to Super Admin. A Normal Backend referral code sends the shop for approval first."
      footer={
        <>
          Already selling on TikiTok Shop?{" "}
          <Link href="/login/store" className="font-medium text-cyan hover:underline">
            Sign in
          </Link>
          <span className="mt-2 block font-mono text-[10px] text-white/40">Release {stamp}</span>
        </>
      }
    >
      <SignupForm error={error} />
    </AuthFrame>
  );
}
