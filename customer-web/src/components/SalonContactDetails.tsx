import { Clock3, MapPin, Phone } from "lucide-react";
import type { SalonPublicDetails } from "../services/types";

export function SalonContactDetails({
  salonName,
  salonAvatarUrl,
  salonHotline,
  salonOpeningHours,
  branchAddress,
  branchDirectionsEnabled,
  preview = false,
}: SalonPublicDetails & {
  branchAddress?: string;
  branchDirectionsEnabled?: boolean;
  preview?: boolean;
}) {
  const dial = salonHotline?.replace(/[ .()-]/g, "") ?? "";
  const showHotline = /^\+?[0-9]{7,15}$/.test(dial);
  const destination = branchAddress?.trim();
  const mapUrl =
    branchDirectionsEnabled === true && destination
      ? `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination })}`
      : "";
  if (!salonAvatarUrl && !showHotline && !salonOpeningHours && !mapUrl) return null;

  return (
    <div className="salon-contact-details">
      {salonAvatarUrl ? (
        <img src={salonAvatarUrl} alt={`Logo ${salonName || "salon"}`} width={48} height={48} />
      ) : null}
      {salonOpeningHours ? (
        <p>
          <Clock3 size={16} aria-hidden="true" />
          <span>
            <strong>Giờ mở cửa</strong> {salonOpeningHours}
          </span>
        </p>
      ) : null}
      {showHotline ? (
        <p>
          <Phone size={16} aria-hidden="true" />
          <span>
            <strong>Hotline</strong>{" "}
            {preview ? <span>{salonHotline}</span> : <a href={`tel:${dial}`}>{salonHotline}</a>}
          </span>
        </p>
      ) : null}
      {mapUrl ? (
        <p>
          <MapPin size={16} aria-hidden="true" />
          {preview ? (
            <span>Chỉ đường</span>
          ) : (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer">
              Chỉ đường
            </a>
          )}
        </p>
      ) : null}
    </div>
  );
}
