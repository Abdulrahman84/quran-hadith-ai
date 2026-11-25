"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { isNativeApp } from "@/lib/native-app";

// The app has no footer, so its info pages end with the privacy and support links.
export function InfoLinks() {
  const { t } = useI18n();

  if (!isNativeApp) {
    return null;
  }

  return (
    <nav aria-label={t("nav.menu")} className="info-links">
      <Link className="text-section-link" href="/privacy">
        {t("nav.privacy")}
      </Link>
      <Link className="text-section-link" href="/support">
        {t("nav.support")}
      </Link>
    </nav>
  );
}
