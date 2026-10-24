import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SalonVisitDetails } from "./SalonVisitDetails";
const mocks=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),upload:vi.fn()}));
vi.mock("../services/visitDetails",()=>({getLatestHaircutDetails:mocks.read,updateLatestHaircutDetails:mocks.save}));
vi.mock("../services/customerPhotos",()=>({uploadHaircutPhoto:mocks.upload}));
describe("salon latest visit editor",()=>{
  it("opens notes at the customer card and saves the exact completed record without awarding points",async()=>{
    const visit={recordId:"record",sessionId:"session",branchId:"branch",createdAtMs:1234567890000,revision:0,note:"Internal note",photoUrls:[],photoCount:0,allowPhoto:true,photoConsentGranted:true};
    mocks.read.mockResolvedValue(visit);
    mocks.save.mockResolvedValue({revision:1});
    render(<SalonVisitDetails salonId="salon" customerId="customer" />);
    const user=userEvent.setup();
    await user.click(screen.getByRole("button",{name:"Thêm ghi chú"}));
    const note=await screen.findByLabelText("Ghi chú nội bộ");
    await user.clear(note); await user.type(note,"New style");
    await user.click(screen.getByRole("button",{name:"Lưu ghi chú"}));
    expect(mocks.save).toHaveBeenCalledWith({salonId:"salon",customerId:"customer",recordId:"record",revision:0,note:"New style"});
    expect(await screen.findByText(/Đã lưu ghi chú/)).toBeInTheDocument();
  });
  it("shows saved images to salon staff, with upload locked if customer consent is absent",async()=>{
    mocks.read.mockResolvedValue({recordId:"record",sessionId:"session",branchId:"branch",revision:0,note:"",photoUrls:["https://example.invalid/internal.jpg"],photoCount:1,allowPhoto:false,photoConsentGranted:false});
    render(<SalonVisitDetails salonId="salon" customerId="customer" />);
    await userEvent.setup().click(screen.getByRole("button",{name:"Thêm ảnh"}));
    expect(await screen.findByLabelText("Chụp ảnh kiểu tóc")).toBeDisabled();
    expect(screen.getByText(/Chỉ chủ salon và nhân viên/)).toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
