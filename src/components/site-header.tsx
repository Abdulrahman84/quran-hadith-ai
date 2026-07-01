"use client";

import Image from "next/image";
import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SiteHeader() {
  const { t } = useI18n();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--color-green)]/10 bg-[var(--color-sand)]/88 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link className="group flex min-w-0 items-center" href="/" aria-label="سند AI">
          <Image
            alt="سند AI"
            className="h-10 w-auto shrink-0 object-contain transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-14"
            height={56}
            priority
            src="/brand/sanad-logo.png"
            width={201}
          />
        </Link>

        <nav className="flex items-center gap-2 text-sm font-black">
          <Link className="nav-link" href="/how-it-works">
            {t("nav.howItWorks")}
          </Link>
          <Link className="nav-link nav-link-mobile-hidden" href="/source-policy">
            {t("nav.sourcePolicy")}
          </Link>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
