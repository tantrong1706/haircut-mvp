import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SalonContactDetails } from "./SalonContactDetails";

it("omits empty and malformed contact details", () => {
  const { container, rerender } = render(<SalonContactDetails />);
  expect(container).toBeEmptyDOMElement();
  rerender(
    <SalonContactDetails salonHotline="javascript:123456789" salonOpeningHours="08:00–20:00" />,
  );
  expect(screen.getByText("08:00–20:00")).toBeVisible();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("uses a safe dial link and a logo label", () => {
  render(
    <SalonContactDetails
      salonHotline="+84 (28) 0000 0000"
      salonAvatarUrl="https://firebasestorage.googleapis.com/fixture"
    />,
  );
  expect(screen.getByRole("link", { name: "+84 (28) 0000 0000" })).toHaveAttribute(
    "href",
    "tel:+842800000000",
  );
  expect(screen.getByRole("img", { name: "Logo salon" })).toBeVisible();
});
