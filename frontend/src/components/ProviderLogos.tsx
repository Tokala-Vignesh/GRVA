import React from 'react';
import { CloudProvider } from '../types';

interface ProviderLogoProps {
  provider: CloudProvider | string;
  className?: string;
  size?: number;
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({ provider, className = 'w-5 h-5', size = 20 }) => {
  const p = (provider || '').toLowerCase();

  switch (p) {
    // 1. AWS
    case 'aws':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path
            d="M6.5 14.5c2.5 1.8 6.5 2.5 9.5 0M15.5 13.5l1.5 1-1.5 1.5"
            stroke="#FF9900"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 10c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"
            stroke="#F90"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#232F3E" />
          <path
            d="M6 14.5c3 2 7 2 10.5-.5M15.5 13.2l1.2 1.3-1.4 1.2"
            stroke="#FF9900"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    // 2. Google Cloud (GCP)
    case 'gcp':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#4285F4" />
          <path d="M19 19H6c-2.76 0-5-2.24-5-5 0-2.45 1.77-4.49 4.14-4.91L6.3 9C7.3 6.9 9.5 5.5 12 5.5c3.2 0 5.8 2.2 6.4 5.2l.2 1.1 1.1.1c2.1.2 3.8 1.9 3.8 4.1 0 2.3-1.9 4.1-4.5 4.1z" fill="#34A853" opacity="0.3" />
        </svg>
      );

    // 3. Microsoft Azure
    case 'azure':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path d="M12.8 3L4 18.2h5.5L12.8 12l4 7.2L20 18.2 12.8 3z" fill="#0089D6" />
          <path d="M12.8 12L9.5 18.2H17l-4.2-6.2z" fill="#0072C6" />
        </svg>
      );

    // 4. Oracle Cloud (OCI)
    case 'oci':
    case 'oracle':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <rect x="2" y="5" width="20" height="14" rx="7" stroke="#F80000" strokeWidth="2.5" fill="#300" fillOpacity="0.3" />
          <path d="M7 12a5 5 0 0 1 10 0" stroke="#F80000" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    // 5. DigitalOcean
    case 'digitalocean':
    case 'do':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path
            d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49V17.5h-1.8v-2.7h1.8v-1.9c0-1.8 1.1-2.8 2.7-2.8.8 0 1.5.1 1.7.1v2h-1.2c-.9 0-1.1.4-1.1 1v1.6h2.3l-.3 2.7h-2v4.02C18.66 20.65 22 16.71 22 12c0-5.52-4.48-10-10-10z"
            fill="#0080FF"
          />
          <rect x="5.5" y="14" width="2" height="2" fill="#0080FF" />
          <rect x="3.5" y="12" width="2" height="2" fill="#0080FF" />
          <rect x="3.5" y="16" width="2" height="2" fill="#0080FF" />
        </svg>
      );

    // 6. Hetzner Cloud
    case 'hetzner':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#D50C2D" />
          <path d="M7 6v12M17 6v12M7 12h10" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    // 7. Render
    case 'render':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path d="M3 17V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#46E3B7" />
          <circle cx="16.5" cy="7.5" r="4.5" fill="#141416" />
          <circle cx="16.5" cy="7.5" r="3.5" fill="#46E3B7" />
        </svg>
      );

    // 8. Cloudflare
    case 'cloudflare':
    case 'cf':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path
            d="M18.8 11.2A5.2 5.2 0 0 0 9 9.5a3.8 3.8 0 0 0-4.5 3.7c0 .2 0 .4.1.6A3.8 3.8 0 0 0 5 21h13.8a4 4 0 0 0 0-8c-.3 0-.7 0-1 .2z"
            fill="#F38020"
          />
          <path
            d="M18.8 11.2c-.3 0-.7 0-1 .2a5.2 5.2 0 0 0-8.8-1.7 3.8 3.8 0 0 0-4.5 4.1c.3 0 .5-.1.8-.1h13.5a4 4 0 0 0 0-2.5z"
            fill="#FAAE40"
          />
        </svg>
      );

    // 9. Vercel
    case 'vercel':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path d="M12 2L23 21H1L12 2z" fill="#FFFFFF" />
        </svg>
      );

    // 10. Supabase
    case 'supabase':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path
            d="M13.5 2.5L3.5 14.5h8l-1.5 7 10-12h-8l1.5-7z"
            fill="#3ECF8E"
            stroke="#249B64"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    // 11. Fly.io
    case 'flyio':
    case 'fly':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path
            d="M12 2C7.5 2 4 5.5 4 10c0 3.2 1.8 6 4.5 7.3V20c0 .6.4 1 1 1h5c.6 0 1-.4 1-1v-2.7c2.7-1.3 4.5-4.1 4.5-7.3 0-4.5-3.5-8-8-8z"
            fill="#7B3FE4"
          />
          <ellipse cx="12" cy="10" rx="3" ry="5" fill="#A873F6" />
          <path d="M10 20h4v2h-4z" fill="#999" />
        </svg>
      );

    // 12. Docker
    case 'docker':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <path
            d="M22.5 11.5c-.3-.2-1.5-.7-3.1-.2-.4-1.2-1.4-2.1-2.4-2.3l-.5.3v2c-1.3.1-2.5.7-3.2 1.7h-9c-.7 0-1.3.6-1.3 1.3v.8c0 3.8 2.6 7 7.5 7 4.9 0 8.3-2.6 9-7.2.9-.2 2.3-.4 3-2.4v-.7z"
            fill="#0db7ed"
          />
          <rect x="7" y="7" width="2" height="2" rx=".3" fill="#0db7ed" />
          <rect x="10" y="7" width="2" height="2" rx=".3" fill="#0db7ed" />
          <rect x="7" y="10" width="2" height="2" rx=".3" fill="#0db7ed" />
          <rect x="10" y="10" width="2" height="2" rx=".3" fill="#0db7ed" />
          <rect x="4" y="10" width="2" height="2" rx=".3" fill="#0db7ed" />
        </svg>
      );

    // 13. Kubernetes
    case 'kubernetes':
    case 'k8s':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <polygon
            points="12,2 21,7.2 21,17.8 12,23 3,17.8 3,7.2"
            stroke="#326CE5"
            strokeWidth="2"
            fill="#326CE5"
            fillOpacity="0.2"
          />
          <circle cx="12" cy="12.5" r="3.5" fill="#326CE5" />
          <path d="M12 4.5v4.5M12 16v4.5M5.5 8.5l3.8 2.2M14.7 13.8l3.8 2.2M5.5 16.5l3.8-2.2M14.7 11.2l3.8-2.2" stroke="#326CE5" strokeWidth="1.5" />
        </svg>
      );

    // 14. Linux & Bare-Metal Server (Prometheus Node Exporter)
    case 'private':
    case 'linux':
    case 'prometheus':
    case 'baremetal':
    case 'linux_server':
    default:
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
          <rect x="3" y="4" width="18" height="6" rx="2" stroke="#E6522C" strokeWidth="1.8" fill="#E6522C" fillOpacity="0.15" />
          <rect x="3" y="14" width="18" height="6" rx="2" stroke="#E6522C" strokeWidth="1.8" fill="#E6522C" fillOpacity="0.15" />
          <circle cx="7" cy="7" r="1.2" fill="#E6522C" />
          <circle cx="7" cy="17" r="1.2" fill="#E6522C" />
          <path d="M14 7h3M14 17h3" stroke="#E6522C" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
};
