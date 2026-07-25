export type PolicyFlowIconType = "source" | "arrange" | "answer";

export function PolicyFlowIcon({ type }: { type: PolicyFlowIconType }) {
  if (type === "source") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path
          d="M5 5.5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v13l-3-1.8-3 1.8-3-1.8-3 1.8v-13Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path d="M8.5 8h7M8.5 11h7M8.5 14h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (type === "arrange") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path d="M7 5h10M7 12h10M7 19h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <path d="M4 5h.01M4 12h.01M4 19h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-7Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M8 8.5h8M8 11.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
