"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SiteHeader() {
  const { t } = useI18n();
  const mobileNavRef = useRef<HTMLDetailsElement>(null);

  function closeMobileNav() {
    if (mobileNavRef.current) {
      mobileNavRef.current.open = false;
    }
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (mobileNavRef.current?.open && event.target instanceof Node && !mobileNavRef.current.contains(event.target)) {
        closeMobileNav();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && mobileNavRef.current?.open) {
        closeMobileNav();
        mobileNavRef.current.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-sand)]/92 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <Link className="group flex min-w-0 items-center" href="/" aria-label="سند AI">
          <Image
            alt="سند AI"
            className="h-10 w-auto shrink-0 object-contain transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-14"
            height={56}
            priority
            src="/brand/sanad-logo.png?v=midnight-manuscript"
            unoptimized
            width={201}
          />
        </Link>

        <nav className="hidden min-w-0 items-center justify-end gap-2 text-sm font-semibold sm:flex">
          <Link className="nav-link" href="/how-it-works">
            {t("nav.howItWorks")}
          </Link>
          <Link className="nav-link" href="/source-policy">
            {t("nav.sourcePolicy")}
          </Link>
          <LanguageSwitcher idPrefix="desktop-language" />
        </nav>

        <details className="mobile-nav relative sm:hidden" ref={mobileNavRef}>
          <summary className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-green)]">
            <span className="sr-only">{t("nav.menu")}</span>
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </summary>
          <nav className="mobile-nav-panel text-sm font-semibold">
            <Link className="nav-link" href="/how-it-works" onClick={closeMobileNav}>
              {t("nav.howItWorks")}
            </Link>
            <Link className="nav-link" href="/source-policy" onClick={closeMobileNav}>
              {t("nav.sourcePolicy")}
            </Link>
            <LanguageSwitcher idPrefix="mobile-language" onLanguageChange={closeMobileNav} />
          </nav>
        </details>
      </div>
    </header>
  );
}
