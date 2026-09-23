"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
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
  "logo-type": "Logo must be a JPEG, PNG, or WebP image.",
  "logo-size": "Logo must be 1.5 MB or smaller.",
  referral: "That LLC code is not valid.",
};

export function SignupForm({ error }: { error?: string }) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [localError, setLocalError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const message = localError || (error ? ERRORS[error] : null);

  function clearLogo() {
    setLogo(null);
    setLogoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function submit(formData: FormData) {
    if (!front || !back) {
      setLocalError(ERRORS.id);
      return;
    }
    formData.set("idFront", front);
    formData.set("idBack", back);
    if (logo) formData.set("logo", logo);
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
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Logo</span>
          <div className="flex items-center gap-3">
            {logoPreview ? (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="" className="size-14 rounded-2xl object-cover ring-1 ring-line" />
                <button
                  type="button"
                  onClick={clearLogo}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-white shadow-sm ring-2 ring-white"
                  aria-label="Remove logo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <div className="grid size-14 place-items-center rounded-2xl bg-soft text-xs font-semibold text-muted">
                Logo
              </div>
            )}
            <input
              ref={logoInputRef}
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block min-w-0 flex-1 text-sm"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                setLogo(file);
                setLogoPreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return file ? URL.createObjectURL(file) : "";
                });
              }}
            />
          </div>
          <span className="block text-xs text-muted">JPEG, PNG, or WebP from your device. 1.5 MB maximum.</span>
        </label>
        <div className="space-y-3 rounded-2xl border border-line bg-soft/60 p-3">
          <div>
            <p className="text-sm font-semibold text-ink">ID card photos</p>
            <p className="mt-0.5 text-xs text-muted">
              Use Gallery or Camera. Camera needs HTTPS and permission.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <IdCardCapture label="ID card front" onFile={setFront} />
            <IdCardCapture label="ID card back" onFile={setBack} />
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">LLC Code</span>
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
          <span className="block text-xs text-muted">Numbers only.</span>
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
