"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SanadLogo } from "@/components/sanad-logo";

export function SiteHeader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const mobileNavRef = useRef<HTMLDetailsElement>(null);

  function isCurrentPage(href: string) {
    return pathname === href;
  }

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
    <header className="site-header fixed inset-x-0 top-0 z-50">
      <div className="site-header-inner mx-auto flex h-20 w-full max-w-[1240px] items-center justify-between gap-3 px-5 sm:px-8">
        <Link className="group flex min-w-0 items-center" href="/" aria-label="سند — Sanad AI">
          <SanadLogo className="transition-transform duration-200 group-hover:-translate-y-0.5" />
        </Link>

        <nav className="hidden min-w-0 items-center justify-end gap-8 text-sm font-semibold md:flex">
          <Link
            aria-current={isCurrentPage("/how-it-works") ? "page" : undefined}
            className="nav-link"
            href="/how-it-works"
          >
            {t("nav.howItWorks")}
          </Link>
          <Link
            aria-current={isCurrentPage("/source-policy") ? "page" : undefined}
            className="nav-link"
            href="/source-policy"
          >
            {t("nav.sourcePolicy")}
          </Link>
          <LanguageSwitcher idPrefix="desktop-language" />
        </nav>

        <details className="mobile-nav relative md:hidden" ref={mobileNavRef}>
          <summary className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]">
            <span className="sr-only">{t("nav.menu")}</span>
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </summary>
          <nav aria-label={t("nav.menu")} className="mobile-nav-panel text-base font-semibold">
            <Link
              aria-current={isCurrentPage("/how-it-works") ? "page" : undefined}
              className="nav-link"
              href="/how-it-works"
              onClick={closeMobileNav}
            >
              {t("nav.howItWorks")}
            </Link>
            <Link
              aria-current={isCurrentPage("/source-policy") ? "page" : undefined}
              className="nav-link"
              href="/source-policy"
              onClick={closeMobileNav}
            >
              {t("nav.sourcePolicy")}
            </Link>
            <LanguageSwitcher idPrefix="mobile-language" onLanguageChange={closeMobileNav} />
          </nav>
        </details>
      </div>
    </header>
  );
}
