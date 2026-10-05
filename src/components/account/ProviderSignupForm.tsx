"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getCategories } from "@/lib/data/categories";
import { providerSignup, AuthApiError } from "@/lib/auth/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";
const sectionHeadingClasses = "text-sm font-semibold text-neutral-900";

/**
 * "Join as a Service Provider" marketplace onboarding (FINAL AUTHENTICATION
 * ARCHITECTURE §5/§9/§13) — a single-page form (kept to one page rather
 * than a multi-step wizard, since the field count here doesn't need one)
 * that collects exactly the fields the spec names, nothing invented.
 * Submission always results in PENDING_APPROVAL on the backend — this form
 * cannot select "Admin" and cannot assign itself the `provider` Cognito
 * group; that happens server-side only after email verification.
 */
export function ProviderSignupForm() {
  const router = useRouter();
  const categories = getCategories();

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [city, setCity] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState("");
  const [bio, setBio] = useState("");
  const [availability, setAvailability] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (selectedCategories.length === 0) {
      setStatus("error");
      setErrorMessage("Select at least one service category.");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await providerSignup({
        name,
        email,
        phone,
        password,
        businessName: businessName || undefined,
        city,
        categories: selectedCategories,
        yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
        bio: bio || undefined,
        availability: availability || undefined,
        termsAccepted,
        privacyAccepted,
      });
      router.push(`/staff/provider/verify?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Container className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-8 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="space-y-5">
          <p className={sectionHeadingClasses}>Account</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClasses}>
                Full name *
              </label>
              <input id="name" type="text" required autoComplete="name" className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="businessName" className={labelClasses}>
                Business / Company name
              </label>
              <input
                id="businessName"
                type="text"
                className={inputClasses}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email" className={labelClasses}>
                Email *
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className={inputClasses}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="phone" className={labelClasses}>
                Mobile number *
              </label>
              <input
                id="phone"
                type="tel"
                required
                autoComplete="tel"
                className={inputClasses}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClasses}>
                Password *
              </label>
              <PasswordInput id="password" required autoComplete="new-password" value={password} onChange={setPassword} />
            </div>
            <div>
              <label htmlFor="confirmPassword" className={labelClasses}>
                Confirm password *
              </label>
              <PasswordInput id="confirmPassword" required autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
            </div>
          </div>
        </div>

        <div className="space-y-5 border-t border-neutral-100 pt-6">
          <p className={sectionHeadingClasses}>Service profile</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={labelClasses}>
                City *
              </label>
              <input id="city" type="text" required className={inputClasses} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label htmlFor="yearsExperience" className={labelClasses}>
                Years of experience
              </label>
              <input
                id="yearsExperience"
                type="number"
                min={0}
                max={60}
                className={inputClasses}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className={labelClasses}>Service categories / skills *</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = selectedCategories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    aria-pressed={active}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-neutral-300 text-neutral-700 hover:border-brand-400"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="availability" className={labelClasses}>
              Availability
            </label>
            <input
              id="availability"
              type="text"
              placeholder="e.g. Mon–Sat, 9am–7pm"
              className={inputClasses}
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="bio" className={labelClasses}>
              Short description
            </label>
            <textarea
              id="bio"
              rows={3}
              className={inputClasses}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell customers a bit about your work."
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-neutral-100 pt-6">
          <label className="flex items-start gap-2.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span>
              I accept the{" "}
              <Link href="/terms" className="font-medium text-brand-700 hover:underline">
                Terms &amp; Conditions
              </Link>
              . *
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
            />
            <span>
              I accept the{" "}
              <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
                Privacy Policy
              </Link>
              . *
            </span>
          </label>
        </div>

        {status === "error" && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full">
          {status === "submitting" ? "Submitting application…" : "Submit application"}
        </Button>

        <p className="text-center text-sm text-neutral-600">
          Already have a Service Provider account?{" "}
          <Link href="/staff/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </Container>
  );
}
