"use client";

import { useState } from "react";
import Link from "next/link";
import { signupMerchantAction } from "@/lib/actions/signup";
import { IdCardCapture } from "@/components/id-card-capture";
import { BRAND_NAME } from "@/lib/brand-name";

const ERRORS: Record<string, string> = {
  email: `That email already has a ${BRAND_NAME} login.`,
  password: "Password must be at least 8 characters.",
  mismatch: "Password and confirmation do not match.",
  setup: `${BRAND_NAME} could not create a shop right now. Try again after the database is ready.`,
  invalid: "Fill in shop name, your name, email, password, and country.",
  id: "Upload both the front and back of the ID card.",
  "id-type": "ID photos must be JPEG, PNG, or WebP.",
  "id-size": "Each ID photo must be 2 MB or smaller after compression.",
  referral: "That LLC code is not valid for a Normal Backend user.",
};

export function SignupForm({ error }: { error?: string }) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");
  const message = localError || (error ? ERRORS[error] : null);

  async function submit(formData: FormData) {
    if (!front || !back) {
      setLocalError(ERRORS.id);
      return;
    }
    formData.set("idFront", front);
    formData.set("idBack", back);
    await signupMerchantAction(formData);
  }

  return (
    <>
      {message ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</p> : null}
      <form action={submit} className="mt-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Shop name</span>
          <input
            name="storeName"
            required
            placeholder="Northline Outfitters"
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input
            name="contactName"
            required
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Confirm password</span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Phone</span>
          <input
            name="phone"
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Country</span>
            <input
              name="country"
              required
              placeholder="United States"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">City</span>
            <input
              name="city"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
        </div>
        <div className="space-y-3 rounded-2xl border border-line bg-soft/60 p-3">
          <div>
            <p className="text-sm font-semibold text-ink">ID card photos</p>
            <p className="mt-0.5 text-xs text-muted">
              Super Admin keeps these on the store record. Use Gallery or Camera. Camera needs HTTPS and permission.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <IdCardCapture label="ID card front" onFile={setFront} />
            <IdCardCapture label="ID card back" onFile={setBack} />
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">LLC Code (optional)</span>
          <input
            name="referralCode"
            inputMode="numeric"
            pattern="[0-9]{8}"
            maxLength={8}
            autoComplete="off"
            placeholder="8-digit number"
            onInput={(event) => {
              event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 8);
            }}
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
          <span className="block text-xs text-muted">
            Numbers only. If you enter a code, Normal Backend reviews and approves the store before it goes live.
          </span>
        </label>
        <button className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-white hover:bg-[#e11d48]">
          Create shop
        </button>
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login/store" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
