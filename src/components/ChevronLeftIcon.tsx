type ChevronLeftIconProps = {
  className?: string
}

export function ChevronLeftIcon({ className }: ChevronLeftIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 8.5 14.5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7.5 1.5L1.75 7.25L7.5 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
