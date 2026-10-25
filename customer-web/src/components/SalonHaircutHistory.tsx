type Record = {id:string;createdAtMs:number|null;staffName:string;note:string;photoUrls:string[]};
export function SalonHaircutHistory({records}:{records:Record[]}) {
  return <div className="salon-haircut-history">
    <strong>Lịch sử gần đây</strong>
    {!records.length?<small>Chưa có lịch sử</small>:records.map(record=><article key={record.id} className="salon-haircut-record">
      <small>{record.createdAtMs?new Date(record.createdAtMs).toLocaleString("vi-VN"):"Chưa có ngày"} · {record.staffName || "Nhân viên"}</small>
      <p>{record.note || "Không ghi chú"}</p>
      {record.photoUrls.length?<div className="haircut-photo-grid">{record.photoUrls.map((url,index)=><div className="haircut-photo" key={url}><img src={url} alt={`Ảnh kiểu tóc lần cắt ${index+1}`} loading="lazy"/></div>)}</div>:null}
    </article>)}
  </div>;
}
