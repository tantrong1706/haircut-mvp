import { Clock3, Phone } from "lucide-react";
import type { SalonPublicDetails } from "../services/types";

export function SalonContactDetails({
  salonName,
  salonAvatarUrl,
  salonHotline,
  salonOpeningHours,
}: SalonPublicDetails) {
  const dial = salonHotline?.replace(/[ .()-]/g, "") ?? "";
  const showHotline = /^\+?[0-9]{7,15}$/.test(dial);
  if (!salonAvatarUrl && !showHotline && !salonOpeningHours) return null;

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
            <strong>Hotline</strong> <a href={`tel:${dial}`}>{salonHotline}</a>
          </span>
        </p>
      ) : null}
    </div>
  );
}
