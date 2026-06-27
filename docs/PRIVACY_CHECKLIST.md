# Privacy Checklist

This app stores customer names, optional phone numbers, haircut history, photos, and rewards. Treat this as sensitive customer data.

## Customer Consent

Ask clearly:

```text
Salon co duoc luu anh kieu toc de lan sau phuc vu tot hon khong?
```

Options:

- Dong y
- Khong dong y

If customer does not consent:

- Do not take photo.
- Do not upload photo.
- Keep only basic notes and points.

## Phone Number

Do not request phone immediately unless needed. Best MVP flow:

1. Use Zalo user ID and display name first.
2. Ask phone number after explaining it helps salon identify customers with the same name.
3. Show staff only the last 4 digits.

## Staff Privacy

Staff should see:

- Customer name.
- Last 4 digits of phone.
- Points.
- History for the selected customer.

Staff should not see:

- Full phone number by default.
- All salon customer exports.
- Settings.
- Wheel configuration.
- Raw data deletion controls.

## Delete Requests

Customer should be able to request:

- Delete stored haircut photos.
- Delete profile.
- Withdraw photo consent.

## Storage

Use paths like:

```text
salons/{salonId}/customers/{customerId}/haircuts/{recordId}/{fileName}
```

Never place customer photos in public storage paths.

