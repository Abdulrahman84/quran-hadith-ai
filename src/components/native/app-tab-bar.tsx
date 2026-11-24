"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

type Tab = {
  href: "/" | "/how-it-works" | "/source-policy";
  labelKey: TranslationKey;
  icon: ReactNode;
};

const iconProps = {
  "aria-hidden": true,
  className: "app-tab-icon",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 1.8,
  viewBox: "0 0 24 24",
} as const;

const tabs: Tab[] = [
  {
    href: "/",
    labelKey: "nav.ask",
    icon: (
      <svg {...iconProps}>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
        <path d="M8.5 9h7M8.5 12h4" />
      </svg>
    ),
  },
  {
    href: "/how-it-works",
    labelKey: "nav.howItWorks",
    icon: (
      <svg {...iconProps}>
        <circle cx="6" cy="6" r="2.25" />
        <circle cx="18" cy="18" r="2.25" />
        <path d="M8.25 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.75" />
      </svg>
    ),
  },
  {
    href: "/source-policy",
    labelKey: "nav.sources",
    icon: (
      <svg {...iconProps}>
        <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function tapFeedback() {
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => undefined);
}

export function AppTabBar() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav aria-label={t("nav.menu")} className="app-tab-bar">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className="app-tab"
            href={tab.href}
            key={tab.href}
            onClick={isActive ? scrollToTop : tapFeedback}
          >
            <span className="app-tab-icon-wrap">{tab.icon}</span>
            <span className="app-tab-label">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
