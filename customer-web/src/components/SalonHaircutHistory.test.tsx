import { render,screen } from "@testing-library/react";
import { expect,it } from "vitest";
import { SalonHaircutHistory } from "./SalonHaircutHistory";
it("shows saved internal notes and photos in the salon history",()=>{
  render(<SalonHaircutHistory records={[{id:"fixture",createdAtMs:1234567890000,note:"Internal style",staffName:"Staff",photoUrls:["https://example.invalid/hair.jpg"]}]}/>);
  expect(screen.getByText("Internal style")).toBeInTheDocument();
  expect(screen.getByRole("img")).toHaveAttribute("src","https://example.invalid/hair.jpg");
});
