/** Scoped tactical styling for the data-driven Encyclopedia panels. */
export default String.raw`
.enc-intro{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:20px;border:1px solid rgba(94,231,255,.22);background:linear-gradient(115deg,rgba(94,231,255,.07),rgba(17,24,39,.2));margin-bottom:22px}
.enc-intro small,.enc-kicker{font:700 10px/1.7 ui-monospace,monospace;letter-spacing:.15em;color:#5ee7ff}
.enc-intro h3{font-size:20px;font-weight:800;color:#f1f5f9;margin:4px 0 7px}
.enc-intro p{color:#94a3b8;font-size:12px;line-height:1.7}
.enc-intro>strong{font:700 30px/1 ui-monospace,monospace;color:#5ee7ff;white-space:nowrap}
.enc-intro>strong small{font-size:10px;letter-spacing:0}
.enc-field{display:flex;flex-direction:column;gap:8px;margin:16px 0;color:#b5c2d3;font-size:12px}
.enc-field input{padding:12px 14px;border:1px solid #334155;background:#0b1018;color:#edf3fa;width:100%;outline:none}
.enc-field input:focus{border-color:#5ee7ff}
.enc-filters{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 18px}
.enc-filters button{border:1px solid #364458;background:#111923;color:#a7b6c9;font-size:11px;padding:7px 11px}
.enc-filters button[data-active=true]{border-color:#5ee7ff;color:#5ee7ff;background:rgba(94,231,255,.09)}
.enc-index-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:15px;align-items:start}
.enc-results,.enc-detail{min-width:0;background:#0d131c;border:1px solid #29374b;padding:12px}
.enc-results{max-height:480px;overflow:auto}
.enc-count{font-size:11px;color:#94a3b8;margin:2px 0 10px}
.enc-row{width:100%;display:flex;justify-content:space-between;align-items:center;text-align:left;gap:12px;background:transparent;border:1px solid transparent;border-bottom-color:#253245;padding:10px;color:#e2e8f0}
.enc-row:hover,.enc-row[data-active=true]{border-color:#5ee7ff;background:rgba(94,231,255,.07)}
.enc-row>div{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:12px}
.enc-row code,.enc-code{font-size:10px;color:#7dd3fc;overflow-wrap:anywhere}
.enc-row small{font-size:10px;color:#a1b2c6;white-space:nowrap}
.enc-detail{position:sticky;top:8px;padding:20px}
.enc-detail h4{color:#f8fafc;font-size:18px;font-weight:800;margin:6px 0 12px}
.enc-tags{display:flex;flex-wrap:wrap;gap:5px;margin:13px 0}
.enc-tags span{font-size:10px;color:#a4dce7;border:1px solid #2e4a57;padding:4px 6px}
.enc-body{white-space:pre-wrap;font-size:12px;line-height:1.85;color:#cbd5e1;margin:13px 0 22px}
.enc-go{background:#5ee7ff;color:#08151d;font-size:12px;font-weight:750;padding:10px 16px}
.enc-go:hover{background:#a5f3fc}
.enc-empty{padding:18px 8px;color:#94a3b8;font-size:12px}
.enc-atlas>h4,.enc-group>h4{font-size:15px;color:#e7effa;font-weight:750;margin:24px 0 12px}
.enc-atlas h4 small{color:#5ee7ff;margin-left:9px;font:12px ui-monospace,monospace}
.enc-steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:7px}
.enc-step{border-left:2px solid #3d7d91;background:#101b27;padding:9px 12px;display:flex;gap:12px;align-items:center;font-size:12px;color:#d0dae6}
.enc-step code{color:#5ee7ff;font-size:11px;white-space:nowrap}
.enc-table-wrap{max-height:520px;overflow:auto;border:1px solid #29374b}
.enc-table{border-collapse:collapse;width:100%;font-size:11px;text-align:left;color:#d2dbe6}
.enc-table th{position:sticky;top:0;background:#172231;color:#9ceafa;font-size:11px;text-align:left}
.enc-table td,.enc-table th{padding:10px;border-bottom:1px solid #29374b;vertical-align:top}
.enc-table code{color:#9cddf3;overflow-wrap:anywhere}
.enc-group>h4 small{margin-left:12px;color:#8296ab;font-size:11px;font-weight:400}
.enc-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.enc-card{min-width:0;background:#101923;border:1px solid #29374b;padding:18px}
.enc-card small{font-size:10px;color:#5ee7ff;letter-spacing:.08em}
.enc-card h5{font-size:15px;font-weight:750;color:#e9f2ff;margin:7px 0}
.enc-card p,.enc-card li,.enc-entry{font-size:12px;line-height:1.75;color:#bac8da}
.enc-card ul{padding-left:18px;list-style:disc;margin-top:10px}
.enc-entry{margin-top:10px;color:#9ceafa}
@media(max-width:700px){.enc-index-layout{grid-template-columns:minmax(0,1fr)}.enc-results{max-height:300px}.enc-detail{position:static}.enc-intro h3{font-size:17px}.enc-intro>strong{font-size:22px}.enc-steps{grid-template-columns:minmax(0,1fr)}}
`;
