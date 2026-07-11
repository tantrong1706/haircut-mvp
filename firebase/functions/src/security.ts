export type MirrorQrRecord = {
  salonId?: unknown;
  qrToken?: unknown;
  isActive?: unknown;
};

export function isValidMirrorQr(
  mirror: MirrorQrRecord | undefined,
  salonId: string,
  qrToken: string,
) {
  return Boolean(
    mirror && mirror.salonId === salonId && mirror.qrToken === qrToken && mirror.isActive === true,
  );
}
