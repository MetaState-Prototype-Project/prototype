interface CertificateRibbonProps {
  className?: string;
  size?: number;
}

export function CertificateRibbon({ className = "", size = 24 }: CertificateRibbonProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer seal ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="currentColor"
        stroke="none"
      />
      
      {/* Inner seal ring */}
      <circle
        cx="12"
        cy="12"
        r="7.5"
        fill="none"
        stroke="white"
        strokeWidth="1"
        opacity="0.3"
      />
      
      {/* Star in center */}
      <path
        d="M12 4 L13.5 8.5 L18 8.5 L14.5 11.5 L16 16 L12 13 L8 16 L9.5 11.5 L6 8.5 L10.5 8.5 Z"
        fill="white"
        stroke="none"
      />
      
      {/* Inner circle around star */}
      <circle
        cx="12"
        cy="12"
        r="5"
        fill="none"
        stroke="white"
        strokeWidth="0.5"
        opacity="0.4"
      />
      
      {/* Decorative notches around outer edge */}
      <path
        d="M12 1 L12.5 2.5 L12 4 L11.5 2.5 Z"
        fill="white"
        opacity="0.6"
      />
      <path
        d="M12 20 L12.5 21.5 L12 23 L11.5 21.5 Z"
        fill="white"
        opacity="0.6"
      />
      <path
        d="M1 12 L2.5 12.5 L4 12 L2.5 11.5 Z"
        fill="white"
        opacity="0.6"
      />
      <path
        d="M20 12 L21.5 12.5 L23 12 L21.5 11.5 Z"
        fill="white"
        opacity="0.6"
      />
      
      {/* Diagonal notches */}
      <path
        d="M4.5 4.5 L5.5 5 L6 6 L5 5.5 Z"
        fill="white"
        opacity="0.6"
      />
      <path
        d="M17.5 17.5 L18.5 18 L19 19 L18 18.5 Z"
        fill="white"
        opacity="0.6"
      />
      <path
        d="M17.5 4.5 L18.5 5 L19 6 L18 5.5 Z"
        fill="white"
        opacity="0.6"
      />
      <path
        d="M4.5 17.5 L5.5 18 L6 19 L5 18.5 Z"
        fill="white"
        opacity="0.6"
      />
    </svg>
  );
}