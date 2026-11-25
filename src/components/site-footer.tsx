"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { SanadLogo } from "@/components/sanad-logo";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="site-footer">
      <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-5 py-8 sm:px-8 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-10">
        <Link aria-label="سند — Sanad AI" className="w-fit" href="/">
          <SanadLogo />
        </Link>
        <div className="grid gap-1 text-sm leading-6">
          <p className="font-semibold text-[var(--color-ink)]">{t("footer.note")}</p>
          <p className="text-xs font-semibold text-[var(--color-muted)]">{t("footer.sources")}</p>
        </div>
        <nav aria-label={t("nav.menu")} className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <Link className="footer-link" href="/how-it-works">
            {t("nav.howItWorks")}
          </Link>
          <Link className="footer-link" href="/source-policy">
            {t("nav.sourcePolicy")}
          </Link>
          <Link className="footer-link" href="/privacy">
            {t("nav.privacy")}
          </Link>
          <Link className="footer-link" href="/support">
            {t("nav.support")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
