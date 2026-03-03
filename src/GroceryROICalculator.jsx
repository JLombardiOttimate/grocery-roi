import { useState, useMemo, useCallback, useRef } from "react";

// ─── Tooltip Data ────────────────────────────────────────────────────────────
const TOOLTIPS = {
  num_stores: { why: "Nearly every formula scales by store count. More stores = more invoices, more GM time on paperwork, more AP complexity.", question: "How many store locations are you operating today?" },
  invoices_per_store_per_week: { why: "Drives the annual invoice volume calculation — the foundation of the labor formulas. Prospects often know monthly totals, so you may need to back into the weekly per-store number.", question: "Roughly how many invoices per week are you processing at each store? Include everything — DSD, broadline, specialty, one-off vendors." },
  ap_team_headcount: { why: "Doesn't change the math — reframes the output. Labor savings displayed as 'equivalent to 0.7 of your 3-person team' is more visceral than raw hours saved.", question: "How many people are on your AP team today? Are they dedicated to invoice processing, or do they wear other hats?" },
  fully_loaded_ap_hourly_rate: { why: "The dollar multiplier for every hour of labor saved or added. Using fully-loaded rate (base + benefits + taxes + overhead) produces an honest, defensible number.", question: "What are you paying your AP team members, all-in? If not sure, what's their base hourly rate and I'll estimate the rest." },
  net_margin_rate: { why: "Powers the Net Profit Multiplier — the most impactful number in the calculator. At 2% margins, every $1 recovered = $50 in equivalent new revenue.", question: "What's your net margin running? In grocery, the margin math changes everything — a small recovery on the cost side can equal massive new revenue." },
  ottimate_annual_cost: { why: "The 'investment' side of the ROI equation. Subtracted from Total Margin Defense Value to show Net Annual Value and Payback Period.", question: null },
  onboarding_cost: { why: "Part of total investment. Standard = $0. Enhanced = $5K-$8K. Complex = $15K-$25K. Including it honestly prevents the 'hidden costs' objection.", question: null },
  contract_years: { why: "Amortizes onboarding cost across the contract term. A $15K onboarding on a 1-year contract hits ROI harder than the same cost over 3 years.", question: null },
  annual_vendor_spend: { why: "The base number that pricing error rate applies to. A 1% error on $5M = $50K. On $20M = $200K. The larger the spend, the larger the absolute leakage.", question: "What's your approximate annual spend across the vendors we'd be validating? If you know monthly COGS, roughly 85% flows through vendor invoices." },
  price_error_rate: { why: "The 'leak rate' — how much vendor pricing deviates from contracted prices. Industry data shows 1-1.2% in manual grocery environments. Summary-level coding can't catch line-item pricing errors.", question: "How often does your team catch a vendor charging more than the contracted price? Can you track that systematically today?" },
  iv_catch_rate: { why: "Acknowledges no system catches 100% of errors. Depends on catalog completeness and item matching quality. Improves over time as catalog matures.", question: null },
  accuracy_adjustment: { why: "The honesty variable. Digital PDFs extract at 92-95%, scanned paper at 80-88%. This adjusts recovery downward to match the prospect's real-world data quality.", question: "What % of invoices are digital PDFs vs scanned paper? How clean is your item catalog — current and maintained, or needs work?" },
  annual_dsd_spend: { why: "DSD invoices have higher error rates than broadline — generated at delivery, often on thermal printers, rushed receiving. Isolating DSD spend gives accurate recovery calculation.", question: "What's your approximate annual spend with DSD vendors — Pepsi, Coke, Frito-Lay, local bakeries, produce? What % of total is DSD vs broadline?" },
  receiving_discrepancy_rate: { why: "DSD receiving is inherently error-prone — hurried drivers, multitasking receivers, fading thermal receipts. Industry benchmarks: 2-8% discrepancy rates.", question: "When DSD drivers deliver, how carefully is the receiver checking quantities? When the invoice comes later, does anyone compare it to what was received?" },
  dsd_catch_rate: { why: "Depends on receiver data quality from IMS integration. Clean digital receivers = 85-95%. Summary-level receiving docs = 70-80%.", question: "Does your receiving process generate a digital record — a PO or receiver in your system — or is it paper-based?" },
  minutes_per_invoice_manual: { why: "Establishes current-state cost. Summary splits = 2-5 min (fast but blind). Line-item coding = 15-25 min. Where they sit on this spectrum determines the savings.", question: "Walk me through how long it takes to process a typical UNFI or Sysco invoice — from arrival to coded and routed. Give me the average, not the best case." },
  auto_process_rate: { why: "Dividing line between automation savings and exception costs. Higher rate = more savings, fewer exceptions. Maps to data quality and improves over time.", question: null },
  minutes_per_invoice_automated: { why: "Even automated invoices need a human touchpoint — quick review, approval click, GL coding glance. Typically 1-4 min vs 8-25 min manual.", question: null },
  minutes_per_exception: { why: "The honest cost of automation. No system processes everything perfectly. At 8 min/exception, it's still faster than full manual — human is correcting, not entering from scratch.", question: "When an invoice has a problem today — wrong vendor, wrong coding — how long does it take to track down the issue and fix it?" },
  current_coding_practice: { why: "The most important qualifier for F2. Determines whether transition cost applies. Line-item coders get immediate massive savings. Summary-split users have a Year 1 transition investment that pays off by Year 2.", question: "When you code an invoice, are you coding each line item individually, or using summary splits — allocating the total across departments like 30% Dairy, 25% Produce?" },
  initial_mapping_hours: { why: "The honest transition cost. Map-once-remember-forever for stable categories. ~1-2 hours per 100 active SKUs. The system learns and applies mappings to future invoices automatically.", question: "Roughly how many active items are you carrying that actually move? Mostly stable center-store, or heavy deli/prepared/meat rotation?" },
  ongoing_variable_coding: { why: "Unlike stable categories that map once, variable categories (deli, meat, seasonal, prepared) rotate and need ongoing coding. This is the cost of visibility — what makes the Penny Gap catchable.", question: "How much of your business is deli, meat, and prepared foods vs center-store grocery?" },
  store_ops_hours: { why: "This is operational labor diverted from customer-facing work. GM time on paperwork costs more per hour AND carries different emotional weight for owners.", question: "How much time does your store manager or receiving lead spend each week on invoice paperwork — collecting DSD slips, making sure everything gets to the office?" },
  effective_gm_rate: { why: "NOT the AP clerk rate — the GM/store manager rate, which is higher. For owner-operators, use the owner's imputed rate — what their time is worth on revenue-generating activities.", question: "Who at the store level handles invoice paperwork — the GM? A receiver? You personally?" },
  uncaptured_credit_rate: { why: "Quantifies 'silent leakage' — promotional discounts, stales/returns, short-ship credits the AP team doesn't have bandwidth to chase. Industry: 0.3-1.5% of spend.", question: "How does your team handle vendor credits — promotional discounts, stales returns, short ships? Is someone actively chasing those, or does it fall to the bottom of the pile?" },
  credit_catch_improvement: { why: "Incremental improvement over current state, not absolute catch rate. 50% default means roughly doubling the prospect's current credit capture rate.", question: "If we caught twice as many vendor credits as your team catches today — not all, but significantly more — how impactful would that be?" },
  current_close_ot: { why: "Overtime is expensive (1.5× base) and demoralizing. Independent grocers: 8-15 hrs/close. Multi-store: 20-40 hrs. Some don't track it because 'that's just how close works.'", question: "Describe the last 48 hours of your most recent month-end close. How many extra hours? Were people working weekends?" },
  automated_close_ot: { why: "Automation doesn't eliminate close OT entirely — judgment calls and unusual transactions remain. But routine reconciliation work is dramatically reduced.", question: null },
  ot_hourly_rate: { why: "Overtime hours cost 1.5× base rate for non-exempt employees. Using OT rate produces accurate cost picture.", question: "Is your AP team hourly or salaried? If hourly, what's their overtime rate?" },
  current_recon_hours: { why: "Steady-state close effort — matching vendor statements, investigating clearing accounts, resolving discrepancies queued all month. With automated matching, much of this evaporates.", question: "Outside the overtime crunch, how many hours does your team spend monthly on close reconciliation — vendor statements, clearing accounts, invoice discrepancies?" },
  automated_recon_hours: { why: "Reconciliation doesn't go to zero, but dramatically reduced when invoices are auto-matched, coded, and posted in real time vs batch-entered at month end.", question: null },
  avoided_fte: { why: "Each new store = 100-300+ invoices/week added to AP workload. Manual = hiring. With Ottimate, the system absorbs the volume.", question: "When you opened your last store, did you have to add AP staff? How much of someone's time does each store consume on AP?" },
  planned_stores: { why: "Binary qualifier. If zero, F6 = $0 and should be excluded. If 1+, reframes Ottimate as growth infrastructure.", question: "Is scaling the business part of the plan — opening new stores, acquiring existing ones? What does the next 12-24 months look like?" },
  annual_fte_cost: { why: "Converts avoided fractional FTE into real dollars. Grocery AP FTE: $38K-$75K depending on market.", question: "What does it cost all-in to have someone on your AP team for a year?" },
  pct_digital: { why: "Digital PDFs extract at 92-95% accuracy. Scanned paper at 80-88%. Format mix directly affects ramp-up speed and correction labor.", question: "How do invoices reach you — mostly emailed PDFs, or scanning a lot of paper?" },
  avg_line_items: { why: "More line items = more extraction complexity, more error opportunity, more mapping work. <50 is straightforward, 100+ is complex.", question: "On a typical broadline order, how many line items? 20-30, or more like 80-100?" },
  data_quality: { why: "Single biggest predictor of implementation timeline. Clean data = fast onboarding. Messy = longer timeline and potentially professional services.", question: "If I looked at your vendor list now, would each vendor appear once with a clean name — or would I see Sysco, SYSCO, Sysco SD, and Sysco-John as separate entries?" }
};

// ─── Formatter ───────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  const s = abs >= 1000000 ? `$${(abs / 1000000).toFixed(2)}M` : abs >= 1000 ? `$${(abs / 1000).toFixed(1)}K` : `$${abs.toFixed(0)}`;
  return n < 0 ? `(${s})` : s;
};
const fmtFull = (n) => {
  if (n === undefined || n === null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  const s = `$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return n < 0 ? `(${s})` : s;
};
const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

// ─── Tooltip Component ───────────────────────────────────────────────────────
function Tip({ id }) {
  const [open, setOpen] = useState(false);
  const t = TOOLTIPS[id];
  if (!t) return null;
  return (
    <span className="relative inline-block ml-1.5">
      <button onClick={() => setOpen(!open)} className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold leading-none inline-flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors" aria-label="Info">?</button>
      {open && (
        <div className="absolute z-50 left-6 top-[-8px] w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-xs text-slate-600 leading-relaxed">
          <button onClick={() => setOpen(false)} className="absolute top-1 right-2 text-slate-400 hover:text-slate-600 text-sm">×</button>
          <p className="font-semibold text-slate-700 mb-1">Why is this here?</p>
          <p className="mb-2">{t.why}</p>
          {t.question && (<><p className="font-semibold text-slate-700 mb-1">Discovery question:</p><p className="italic text-blue-700">"{t.question}"</p></>)}
        </div>
      )}
    </span>
  );
}

// ─── Input Components ────────────────────────────────────────────────────────
function NumInput({ label, tipId, value, onChange, min, max, step = 1, prefix = "", suffix = "", disabled = false, note = "" }) {
  return (
    <div className={`mb-3 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <label className="flex items-center text-xs font-medium text-slate-600 mb-1">
        {label}<Tip id={tipId} />
      </label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
        <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} min={min} max={max} step={step}
          className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400" />
        {suffix && <span className="text-xs text-slate-400 whitespace-nowrap">{suffix}</span>}
      </div>
      {note && <p className="text-[10px] text-slate-400 mt-0.5">{note}</p>}
    </div>
  );
}

function SelectInput({ label, tipId, value, onChange, options, disabled = false }) {
  return (
    <div className={`mb-3 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <label className="flex items-center text-xs font-medium text-slate-600 mb-1">{label}<Tip id={tipId} /></label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────
function Section({ title, subtitle, active, result, formulaExplanation, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showCalc, setShowCalc] = useState(false);
  return (
    <div className={`mb-4 border rounded-lg ${active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}>
      <button onClick={() => active && setOpen(!open)} className={`w-full px-4 py-3 flex items-center justify-between text-left ${active ? "hover:bg-slate-50" : ""}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${active ? "text-slate-800" : "text-slate-400"}`}>{title}</h3>
            {!active && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Not available on this path</span>}
          </div>
          {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold tabular-nums ${!active ? "text-slate-300" : result >= 0 ? "text-emerald-600" : "text-red-500"}`}>{active ? fmtFull(result) : "$0"}</span>
          {active && <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>}
        </div>
      </button>
      {open && active && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="pt-3 grid grid-cols-2 md:grid-cols-3 gap-x-4">{children}</div>
          {formulaExplanation && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <button onClick={() => setShowCalc(!showCalc)} className="text-[11px] text-blue-500 hover:text-blue-700 font-medium">
                {showCalc ? "▲ Hide calculation" : "▼ How is this calculated?"}
              </button>
              {showCalc && <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 rounded p-3 leading-relaxed font-mono whitespace-pre-wrap">{formulaExplanation}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Calculator ─────────────────────────────────────────────────────────
export default function GroceryROICalculator() {
  // Path
  const [path, setPath] = useState(4);

  // Global
  const [stores, setStores] = useState(0);
  const [invPerStore, setInvPerStore] = useState(0);
  const [apHeadcount, setApHeadcount] = useState(0);
  const [apRate, setApRate] = useState(0);
  const [margin, setMargin] = useState(0.01);
  const [annualCost, setAnnualCost] = useState(0);
  const [onboardCost, setOnboardCost] = useState(0);
  const [contractYrs, setContractYrs] = useState(1);
  const [prospectName, setProspectName] = useState("");

  // F1
  const [vendorSpend, setVendorSpend] = useState(0);
  const [errorRate, setErrorRate] = useState(0.012);
  const [ivCatch, setIvCatch] = useState(0.75);
  const [accAdj, setAccAdj] = useState(0.85);
  const [dsdSpend, setDsdSpend] = useState(0);
  const [discRate, setDiscRate] = useState(0.04);
  const [dsdCatch, setDsdCatch] = useState(0.85);

  // F2
  const [manualMin, setManualMin] = useState(0);
  const [autoRate, setAutoRate] = useState(0.85);
  const [autoMin, setAutoMin] = useState(2);
  const [excMin, setExcMin] = useState(0);
  const [codingPractice, setCodingPractice] = useState("summary");
  const [mappingHrs, setMappingHrs] = useState(40);
  const [ongoingHrs, setOngoingHrs] = useState(1.5);

  // F3
  const [storeOpsHrs, setStoreOpsHrs] = useState(0);
  const [gmRate, setGmRate] = useState(0);

  // F4
  const [creditRate, setCreditRate] = useState(0.007);
  const [creditImprove, setCreditImprove] = useState(0.5);

  // F5
  const [curOT, setCurOT] = useState(0);
  const [autoOT, setAutoOT] = useState(3);
  const [otRate, setOtRate] = useState(0);
  const [curRecon, setCurRecon] = useState(0);
  const [autoRecon, setAutoRecon] = useState(6);

  // F6
  const [avoidedFTE, setAvoidedFTE] = useState(0.25);
  const [newStores, setNewStores] = useState(0);
  const [fteCost, setFteCost] = useState(0);

  // Time-to-Value
  const [pctDigital, setPctDigital] = useState("high");
  const [avgLineItems, setAvgLineItems] = useState("low");
  const [dataQuality, setDataQuality] = useState("clean");

  // ─── Path Logic ──────────────────────────────────────────────────────────
  const f1Active = path >= 2;
  const f4Active = path === 2 || path === 4;
  const hasIV = path === 2 || path === 4;
  const hasDSD = path === 3 || path === 4;

  // ─── Calculations ────────────────────────────────────────────────────────
  const annualVolume = stores * invPerStore * 52;

  // F1
  const f1IV = hasIV ? vendorSpend * errorRate * ivCatch * accAdj : 0;
  const f1DSD = hasDSD ? dsdSpend * discRate * dsdCatch : 0;
  const f1IVAdj = (path === 4) ? Math.max(0, vendorSpend - dsdSpend) * errorRate * ivCatch * accAdj : f1IV;
  const f1Total = f1Active ? (path === 4 ? f1DSD + f1IVAdj : (hasIV ? f1IV : f1DSD)) : 0;

  // F2
  const curManualCost = annualVolume * manualMin * (apRate / 60);
  const postAutoCost = annualVolume * autoRate * autoMin * (apRate / 60);
  const compA = curManualCost - postAutoCost;
  const compB = annualVolume * (1 - autoRate) * excMin * (apRate / 60);
  const needsTransition = codingPractice !== "line-item" && path >= 2;
  const compC_y1 = needsTransition ? (mappingHrs * apRate) + (ongoingHrs * apRate * 52) : 0;
  const compC_y2 = needsTransition ? (ongoingHrs * apRate * 52) : 0;
  const f2Year1 = compA - compB - compC_y1;
  const f2Year2 = compA - compB - compC_y2;
  const f2Total = f2Year1;
  const fteEquiv = (compA / (apRate * 2080)).toFixed(1);

  // F3
  const f3Total = stores * storeOpsHrs * 52 * gmRate;

  // F4
  const f4Total = f4Active ? vendorSpend * creditRate * creditImprove : 0;

  // F5
  const f5Total = ((curOT - autoOT) * 12 * otRate) + ((curRecon - autoRecon) * 12 * apRate);

  // F6
  const f6Total = avoidedFTE * newStores * fteCost;

  // F7
  const tmdv = (f1Active ? f1Total : 0) + f2Total + f3Total + (f4Active ? f4Total : 0) + f5Total + f6Total;
  const annualizedOnboard = onboardCost / Math.max(contractYrs, 1);
  const netAnnual = tmdv - annualCost - annualizedOnboard;
  const paybackMonths = tmdv > 0 ? ((annualCost + onboardCost) / (tmdv / 12)).toFixed(1) : "N/A";
  const multiplier = margin > 0 ? netAnnual / margin : 0;

  // Time to Value
  const ttvScores = { high: 1, medium: 2, low: 3, clean: 1, moderate: 2, messy: 3 };
  const ttvWorst = Math.max(ttvScores[pctDigital] || 2, ttvScores[avgLineItems] || 2, ttvScores[dataQuality] || 2);
  const ttvProfile = ttvWorst === 1 ? { label: "Standard", range: "30–60 days", color: "emerald" } : ttvWorst === 2 ? { label: "Enhanced", range: "60–90 days", color: "amber" } : { label: "Complex", range: "90–180 days", color: "red" };

  // ─── PDF Export ──────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const pathNames = { 1: "Core AP Only", 2: "Core AP + Item Validation", 3: "Core AP + DSD Receiver Match", 4: "Core AP + DSD Receiver + Item Validation" };
    const kv = (label, value) => `<span class="kv"><span class="k">${label}:</span> <span class="v">${value}</span></span>`;

    // F1 inputs
    let f1Inputs = "";
    if (f1Active) {
      const parts = [];
      if (hasIV) {
        parts.push(kv("Vendor Spend", fmtFull(vendorSpend)), kv("Error Rate", (errorRate*100).toFixed(1)+"%"), kv("IV Catch", (ivCatch*100)+"%"), kv("Accuracy Adj", (accAdj*100)+"%"));
      }
      if (hasDSD) {
        parts.push(kv("DSD Spend", fmtFull(dsdSpend)), kv("Discrepancy Rate", (discRate*100).toFixed(1)+"%"), kv("DSD Catch", (dsdCatch*100)+"%"));
      }
      f1Inputs = parts.join(" ");
    }

    // F2 inputs
    const f2Inputs = [
      kv("Manual", manualMin+"min"), kv("Auto Rate", (autoRate*100)+"%"), kv("Automated", autoMin+"min"), kv("Exception", excMin+"min"),
      kv("Coding", codingPractice === "line-item" ? "Line-item" : codingPractice === "summary" ? "Summary splits" : "Mixed"),
      needsTransition ? kv("Mapping", mappingHrs+"hrs") : "", needsTransition ? kv("Ongoing", ongoingHrs+"hrs/wk") : "",
    ].filter(Boolean).join(" ");

    // F3 inputs
    const f3Inputs = [kv("Store Ops", storeOpsHrs+"hrs/wk"), kv("GM Rate", "$"+gmRate+"/hr")].join(" ");

    // F4 inputs
    const f4Inputs = f4Active ? [kv("Credit Rate", (creditRate*100).toFixed(1)+"%"), kv("Catch Improvement", (creditImprove*100)+"%")].join(" ") : "";

    // F5 inputs
    const f5Inputs = [kv("Current OT", curOT+"hrs"), kv("Auto OT", autoOT+"hrs"), kv("OT Rate", "$"+otRate), kv("Current Recon", curRecon+"hrs"), kv("Auto Recon", autoRecon+"hrs")].join(" ");

    // F6 inputs
    const f6Inputs = newStores > 0 ? [kv("Avoided FTE", avoidedFTE), kv("New Stores", newStores+"/yr"), kv("FTE Cost", fmtFull(fteCost))].join(" ") : "";

    const fRow = (num, name, inputs, value, active = true) => {
      if (!active) return "";
      const color = value >= 0 ? "#16a34a" : "#ef4444";
      return `<div class="f-row">
        <div class="f-header"><span class="f-num">${num}</span><span class="f-name">${name}</span><span class="f-val" style="color:${color}">${fmtFull(value)}</span></div>
        <div class="f-inputs">${inputs}</div>
      </div>`;
    };

    const html = `<!DOCTYPE html><html><head><title>Margin Defense Summary - ${prospectName || 'Prospect'}</title>
<style>
@page{size:letter;margin:0.4in}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;font-size:8.5px;color:#1e293b;line-height:1.4}
.hdr{background:#0f172a;color:white;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.hdr h1{font-size:13px;font-weight:700}.hdr .sub{font-size:9px;color:#94a3b8}
.hdr .right{text-align:right}.hdr .right .name{font-size:11px;font-weight:600}.hdr .right .date{font-size:8px;color:#94a3b8}
.cols{display:flex;gap:10px}
.col-left{flex:1}.col-right{width:200px}
.section-title{font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;padding:4px 0 3px;border-bottom:1.5px solid #0f172a;margin-bottom:5px;margin-top:8px}
.globals{display:flex;flex-wrap:wrap;gap:2px 12px;margin-bottom:4px}
.kv{white-space:nowrap}.k{color:#64748b}.v{font-weight:600;color:#1e293b}
.f-row{border:1px solid #e2e8f0;border-radius:4px;padding:5px 8px;margin-bottom:4px}
.f-header{display:flex;align-items:center;gap:6px;margin-bottom:2px}
.f-num{background:#0f172a;color:white;font-size:7px;font-weight:700;padding:1px 4px;border-radius:2px}
.f-name{font-size:8.5px;font-weight:600;flex:1}
.f-val{font-size:10px;font-weight:800;text-align:right}
.f-inputs{font-size:7.5px;color:#64748b;display:flex;flex-wrap:wrap;gap:1px 8px}
.summary-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:6px;padding:8px;margin-bottom:6px}
.s-row{display:flex;justify-content:space-between;padding:2px 0;font-size:8.5px}
.s-row .s-label{color:#64748b}.s-row .s-val{font-weight:600}
.s-row.total{border-top:1.5px solid #0f172a;margin-top:3px;padding-top:4px}.s-row.total .s-val{font-size:11px;font-weight:800}
.nav-box{text-align:center;padding:10px 8px;border-radius:6px;margin-bottom:6px}
.nav-box.green{background:#f0fdf4;border:1.5px solid #22c55e}.nav-box.blue{background:#eff6ff;border:1.5px solid #3b82f6}
.nav-box .big{font-weight:800}.nav-box .lbl{font-size:7.5px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}
.nav-box p{font-size:7.5px;color:#475569;margin-top:3px}
.meta-row{display:flex;gap:6px;margin-bottom:6px}
.meta-card{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px;text-align:center}
.meta-card .lbl{font-size:7px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}
.meta-card .val{font-size:11px;font-weight:800;color:#0f172a}
.meta-card .sub{font-size:7px;color:#94a3b8}
.footer{text-align:center;font-size:7px;color:#94a3b8;margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0}
</style></head><body>

<div class="hdr">
  <div><h1>Ottimate Margin Defense Summary</h1><div class="sub">${pathNames[path]}</div></div>
  <div class="right"><div class="name">${prospectName || '[Prospect Name]'}</div><div class="date">${new Date().toLocaleDateString()} &nbsp;|&nbsp; Time-to-Value: ${ttvProfile.label} (${ttvProfile.range})</div></div>
</div>

<div class="cols">
<div class="col-left">

<div class="section-title">Operation Profile</div>
<div class="globals">
  ${kv("Stores", stores)} ${kv("Inv/Store/Wk", invPerStore)} ${kv("Annual Volume", annualVolume.toLocaleString())}
  ${kv("AP Team", apHeadcount+" people")} ${kv("AP Rate", "$"+apRate+"/hr")} ${kv("Net Margin", (margin*100).toFixed(1)+"%")}
  ${kv("Ottimate Annual", fmtFull(annualCost))} ${kv("Onboarding", fmtFull(onboardCost))} ${kv("Contract", contractYrs+"yr")}
</div>

<div class="section-title">Formula Results &amp; Key Inputs</div>
${fRow("F1", "Pricing Variance Recovery", f1Inputs, f1Total, f1Active)}
${fRow("F2", "Net Invoice Processing Labor" + (f2Year1 !== f2Year2 ? " (Yr1)" : ""), f2Inputs, f2Total, true)}
${f2Year1 !== f2Year2 ? `<div style="font-size:7.5px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:3px;padding:3px 8px;margin:-2px 0 4px;"><b>Year 2+ steady state:</b> ${fmtFull(f2Year2)} (initial mapping complete) &nbsp;|&nbsp; <b>FTE Equiv:</b> ${fteEquiv} of ${apHeadcount}-person team</div>` : `<div style="font-size:7.5px;color:#475569;margin:-2px 0 4px 0;padding-left:8px"><b>FTE Equiv:</b> ${fteEquiv} of ${apHeadcount}-person team</div>`}
${fRow("F3", "Store-Level Ops Recovery", f3Inputs, f3Total, true)}
${fRow("F4", "Vendor Credit Recovery", f4Inputs, f4Total, f4Active)}
${fRow("F5", "Month-End Close Efficiency", f5Inputs, f5Total, true)}
${newStores > 0 ? fRow("F6", "Multi-Store Scalability", f6Inputs, f6Total, true) : ""}

</div>
<div class="col-right">

<div class="section-title">F7: Total Margin Defense Value</div>
<div class="summary-box">
  ${f1Active ? `<div class="s-row"><span class="s-label">F1 Pricing Variance</span><span class="s-val">${fmt(f1Total)}</span></div>` : ""}
  <div class="s-row"><span class="s-label">F2 Invoice Processing</span><span class="s-val" style="color:${f2Total>=0?'#16a34a':'#ef4444'}">${fmt(f2Total)}</span></div>
  <div class="s-row"><span class="s-label">F3 Store Ops</span><span class="s-val">${fmt(f3Total)}</span></div>
  ${f4Active ? `<div class="s-row"><span class="s-label">F4 Credits</span><span class="s-val">${fmt(f4Total)}</span></div>` : ""}
  <div class="s-row"><span class="s-label">F5 Month-End</span><span class="s-val">${fmt(f5Total)}</span></div>
  ${f6Total > 0 ? `<div class="s-row"><span class="s-label">F6 Scalability</span><span class="s-val">${fmt(f6Total)}</span></div>` : ""}
  <div class="s-row total"><span class="s-label">Gross TMDV</span><span class="s-val">${fmtFull(tmdv)}</span></div>
  <div class="s-row"><span class="s-label">Less: Investment</span><span class="s-val" style="color:#ef4444">(${fmtFull(annualCost + annualizedOnboard)})</span></div>
</div>

<div class="nav-box green">
  <div class="lbl">Net Annual Value</div>
  <div class="big" style="font-size:18px;color:${netAnnual>=0?'#16a34a':'#ef4444'}">${fmtFull(netAnnual)}</div>
</div>

<div class="meta-row">
  <div class="meta-card"><div class="lbl">Payback</div><div class="val">${paybackMonths}</div><div class="sub">months</div></div>
  <div class="meta-card"><div class="lbl">Time-to-Value</div><div class="val" style="font-size:9px">${ttvProfile.label}</div><div class="sub">${ttvProfile.range}</div></div>
</div>

<div class="nav-box blue">
  <div class="lbl">Net Profit Multiplier</div>
  <div class="big" style="font-size:15px;color:#2563eb">${fmtFull(multiplier)}</div>
  <p>This recovery equals generating <b>${fmtFull(multiplier)}</b> in new revenue at ${(margin*100).toFixed(1)}% margins.</p>
</div>

</div>
</div>

<div class="footer">Ottimate Grocery ROI Calculator &nbsp;|&nbsp; Generated ${new Date().toLocaleDateString()} &nbsp;|&nbsp; Confidential</div>
</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    }
  }, [path, stores, invPerStore, annualVolume, apHeadcount, apRate, margin, annualCost, onboardCost, contractYrs, prospectName, f1Active, f1Total, hasIV, hasDSD, vendorSpend, errorRate, ivCatch, accAdj, dsdSpend, discRate, dsdCatch, f2Total, f2Year1, f2Year2, fteEquiv, manualMin, autoRate, autoMin, excMin, codingPractice, needsTransition, mappingHrs, ongoingHrs, f3Total, storeOpsHrs, gmRate, f4Active, f4Total, creditRate, creditImprove, f5Total, curOT, autoOT, otRate, curRecon, autoRecon, f6Total, newStores, avoidedFTE, fteCost, tmdv, annualizedOnboard, netAnnual, paybackMonths, ttvProfile, multiplier]);

  // CSV
  const handleCSV = useCallback(() => {
    const rows = [
      ["Field", "Value"],
      ["Prospect", prospectName],
      ["Stores", stores], ["Inv/Store/Wk", invPerStore], ["Annual Volume", annualVolume],
      ["AP Headcount", apHeadcount], ["AP Rate", apRate], ["Margin", margin],
      ["Ottimate Annual", annualCost], ["Onboarding", onboardCost], ["Contract Yrs", contractYrs],
      ["F1 PVR", f1Total], ["F2 NIPLI Yr1", f2Total], ["F2 NIPLI Yr2", f2Year2],
      ["F3 SOTR", f3Total], ["F4 VCAR", f4Total], ["F5 MECEG", f5Total], ["F6 MSSS", f6Total],
      ["TMDV", tmdv], ["Net Annual", netAnnual], ["Payback Mo", paybackMonths], ["Revenue Equiv", multiplier],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${prospectName || "Prospect"}_ROI_Data.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [prospectName, stores, invPerStore, annualVolume, apHeadcount, apRate, margin, annualCost, onboardCost, contractYrs, f1Total, f2Total, f2Year2, f3Total, f4Total, f5Total, f6Total, tmdv, netAnnual, paybackMonths, multiplier]);

  // ─── Clear Data ────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    if (!window.confirm("Reset all fields to defaults? This can't be undone.")) return;
    setPath(1); setStores(0); setInvPerStore(0); setApHeadcount(0); setApRate(0);
    setMargin(0.02); setAnnualCost(0); setOnboardCost(0); setContractYrs(1); setProspectName("");
    setVendorSpend(0); setErrorRate(0.012); setIvCatch(0.75); setAccAdj(0.85);
    setDsdSpend(0); setDiscRate(0.04); setDsdCatch(0.85);
    setManualMin(0); setAutoRate(0.85); setAutoMin(2); setExcMin(0);
    setCodingPractice("summary"); setMappingHrs(40); setOngoingHrs(1.5);
    setStoreOpsHrs(0); setGmRate(0); setCreditRate(0.007); setCreditImprove(0.5);
    setCurOT(0); setAutoOT(3); setOtRate(0); setCurRecon(0); setAutoRecon(6);
    setAvoidedFTE(0.25); setNewStores(0); setFteCost(0);
    setPctDigital("high"); setAvgLineItems("low"); setDataQuality("clean");
  }, []);

  // ─── Path Names ────────────────────────────────────────────────────────────
  const pathOptions = [
    { v: 1, label: "Core AP Only", desc: "Invoice capture, GL coding, approvals" },
    { v: 2, label: "Core AP + Item Validation", desc: "Catalog-based price comparison, credit requests" },
    { v: 3, label: "Core AP + DSD Receiver Match", desc: "Receiver-to-invoice matching" },
    { v: 4, label: "Core AP + DSD Receiver + IV", desc: "Full margin defense stack" },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <img src={`${import.meta.env.BASE_URL}ottimate-logo.svg`} alt="Ottimate" className="h-8 w-auto" />
              <div>
                <p className="text-slate-400 text-xs">Grocery ROI Calculator</p>
              </div>
            </div>
            <input value={prospectName} onChange={e => setProspectName(e.target.value)} placeholder="Prospect name..." className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 w-44 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded transition-colors">
              ↓ Save as PDF
            </button>
            <button onClick={handleCSV} className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-1.5 rounded transition-colors">
              ↓ Export CSV
            </button>
            <button onClick={handleClear} className="bg-slate-800 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-xs font-semibold px-4 py-1.5 rounded border border-slate-700 hover:border-red-700 transition-colors ml-auto">
              ✕ Clear All
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Solution Path */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Solution Path</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {pathOptions.map(p => (
              <button key={p.v} onClick={() => setPath(p.v)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${path === p.v ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                <div className={`text-xs font-semibold ${path === p.v ? "text-blue-700" : "text-slate-700"}`}>{p.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-1 mt-3 text-[10px]">
            <span className="text-slate-400">Active formulas:</span>
            {["F1", "F2", "F3", "F4", "F5", "F6", "F7"].map(f => {
              const on = f === "F1" ? f1Active : f === "F4" ? f4Active : true;
              return <span key={f} className={`px-1.5 py-0.5 rounded ${on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400 line-through"}`}>{f}</span>;
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Inputs */}
          <div className="lg:col-span-2 space-y-4">
            {/* Global Inputs */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Global Inputs</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4">
                <NumInput label="Number of Stores" tipId="num_stores" value={stores} onChange={setStores} min={1} max={100} />
                <NumInput label="Invoices / Store / Week" tipId="invoices_per_store_per_week" value={invPerStore} onChange={setInvPerStore} min={30} max={500} />
                <div className="mb-3">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Annual Invoice Volume</label>
                  <div className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600 font-semibold tabular-nums">{annualVolume.toLocaleString()}</div>
                </div>
                <NumInput label="AP Team Headcount" tipId="ap_team_headcount" value={apHeadcount} onChange={setApHeadcount} min={1} max={20} />
                <NumInput label="AP Hourly Rate (Loaded)" tipId="fully_loaded_ap_hourly_rate" value={apRate} onChange={setApRate} min={18} max={45} prefix="$" suffix="/hr" />
                <NumInput label="Net Margin" tipId="net_margin_rate" value={margin} onChange={setMargin} min={0.005} max={0.05} step={0.005} suffix={`(${(margin * 100).toFixed(1)}%)`} />
                <NumInput label="Ottimate Annual Cost" tipId="ottimate_annual_cost" value={annualCost} onChange={setAnnualCost} min={0} max={500000} prefix="$" />
                <NumInput label="Onboarding Cost" tipId="onboarding_cost" value={onboardCost} onChange={setOnboardCost} min={0} max={25000} prefix="$" />
                <NumInput label="Contract Years" tipId="contract_years" value={contractYrs} onChange={setContractYrs} min={1} max={3} />
              </div>
            </div>

            {/* F1: Pricing Variance Recovery */}
            <Section title="F1: Pricing Variance Recovery" subtitle="The Penny Gap — vendor pricing errors your current process can't detect" active={f1Active} result={f1Total}
              formulaExplanation={f1Active ? (
                path === 4 ? `DSD Recovery = $${dsdSpend.toLocaleString()} × ${(discRate*100).toFixed(1)}% × ${(dsdCatch*100)}% = ${fmtFull(f1DSD)}\nIV Recovery = $${Math.max(0,vendorSpend-dsdSpend).toLocaleString()} × ${(errorRate*100).toFixed(1)}% × ${(ivCatch*100)}% × ${(accAdj*100)}% = ${fmtFull(f1IVAdj)}\nTotal = ${fmtFull(f1Total)}`
                : hasIV ? `$${vendorSpend.toLocaleString()} × ${(errorRate*100).toFixed(1)}% error rate × ${(ivCatch*100)}% catch rate × ${(accAdj*100)}% accuracy = ${fmtFull(f1Total)}`
                : `$${dsdSpend.toLocaleString()} × ${(discRate*100).toFixed(1)}% discrepancy × ${(dsdCatch*100)}% catch rate = ${fmtFull(f1Total)}`
              ) : null}>
              {hasIV && <NumInput label="Annual Vendor Spend" tipId="annual_vendor_spend" value={vendorSpend} onChange={setVendorSpend} min={0} max={100000000} prefix="$" />}
              {hasIV && <NumInput label="Price Error Rate" tipId="price_error_rate" value={errorRate} onChange={setErrorRate} min={0.005} max={0.03} step={0.001} suffix={`(${(errorRate*100).toFixed(1)}%)`} />}
              {hasIV && <NumInput label="IV Catch Rate" tipId="iv_catch_rate" value={ivCatch} onChange={setIvCatch} min={0.6} max={0.9} step={0.05} suffix={`(${(ivCatch*100)}%)`} />}
              {hasIV && <NumInput label="Accuracy Adjustment" tipId="accuracy_adjustment" value={accAdj} onChange={setAccAdj} min={0.7} max={0.95} step={0.05} suffix={`(${(accAdj*100)}%)`} />}
              {hasDSD && <NumInput label="Annual DSD Spend" tipId="annual_dsd_spend" value={dsdSpend} onChange={setDsdSpend} min={0} max={50000000} prefix="$" />}
              {hasDSD && <NumInput label="Receiving Discrepancy Rate" tipId="receiving_discrepancy_rate" value={discRate} onChange={setDiscRate} min={0.02} max={0.08} step={0.005} suffix={`(${(discRate*100).toFixed(1)}%)`} />}
              {hasDSD && <NumInput label="DSD Catch Rate" tipId="dsd_catch_rate" value={dsdCatch} onChange={setDsdCatch} min={0.7} max={0.95} step={0.05} suffix={`(${(dsdCatch*100)}%)`} />}
            </Section>

            {/* F2: Net Invoice Processing Labor */}
            <Section title="F2: Net Invoice Processing Labor" subtitle="Automation savings minus exceptions minus transition cost" active={true} result={f2Total} defaultOpen={false}
              formulaExplanation={`Component A (Automation Savings):\n  Current: ${annualVolume.toLocaleString()} inv × ${manualMin} min × $${apRate}/60 = ${fmtFull(curManualCost)}\n  Automated: ${annualVolume.toLocaleString()} × ${(autoRate*100)}% × ${autoMin} min × $${apRate}/60 = ${fmtFull(postAutoCost)}\n  Savings: ${fmtFull(compA)}\n\nComponent B (Exception Labor):\n  ${annualVolume.toLocaleString()} × ${((1-autoRate)*100).toFixed(0)}% exceptions × ${excMin} min × $${apRate}/60 = ${fmtFull(compB)}\n\nComponent C (Transition Cost):\n  Year 1: ${needsTransition ? `${mappingHrs}hrs × $${apRate} + ${ongoingHrs}hrs/wk × $${apRate} × 52 = ${fmtFull(compC_y1)}` : "N/A — already coding line-item"}\n  Year 2+: ${needsTransition ? `${ongoingHrs}hrs/wk × $${apRate} × 52 = ${fmtFull(compC_y2)}` : "$0"}\n\nNet Year 1: ${fmtFull(compA)} − ${fmtFull(compB)} − ${fmtFull(compC_y1)} = ${fmtFull(f2Year1)}\nNet Year 2: ${fmtFull(compA)} − ${fmtFull(compB)} − ${fmtFull(compC_y2)} = ${fmtFull(f2Year2)}\n\nFTE Equivalent: ${fteEquiv} of your ${apHeadcount}-person AP team`}>
              <NumInput label="Minutes / Invoice (Manual)" tipId="minutes_per_invoice_manual" value={manualMin} onChange={setManualMin} min={5} max={25} suffix="min" />
              <NumInput label="Auto-Process Rate" tipId="auto_process_rate" value={autoRate} onChange={setAutoRate} min={0.7} max={0.95} step={0.05} suffix={`(${(autoRate*100)}%)`} />
              <NumInput label="Minutes / Invoice (Automated)" tipId="minutes_per_invoice_automated" value={autoMin} onChange={setAutoMin} min={1} max={4} suffix="min" />
              <NumInput label="Minutes / Exception" tipId="minutes_per_exception" value={excMin} onChange={setExcMin} min={5} max={15} suffix="min" />
              <SelectInput label="Current Coding Practice" tipId="current_coding_practice" value={codingPractice} onChange={setCodingPractice}
                options={[{ value: "line-item", label: "Already line-item" }, { value: "summary", label: "Summary splits" }, { value: "mixed", label: "Mixed" }]} />
              {needsTransition && <NumInput label="Initial Mapping Hours" tipId="initial_mapping_hours" value={mappingHrs} onChange={setMappingHrs} min={20} max={120} suffix="hrs (one-time)" />}
              {needsTransition && <NumInput label="Ongoing Variable Coding" tipId="ongoing_variable_coding" value={ongoingHrs} onChange={setOngoingHrs} min={0.5} max={4} step={0.5} suffix="hrs/week" />}
              {f2Year1 !== f2Year2 && (
                <div className="col-span-full mt-1 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                  <span className="font-semibold">Year 1:</span> {fmtFull(f2Year1)} (includes {fmtFull(mappingHrs * apRate)} mapping investment) &nbsp;→&nbsp; <span className="font-semibold">Year 2+:</span> {fmtFull(f2Year2)} (steady state)
                </div>
              )}
              <div className="col-span-full mt-1 p-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-800">
                FTE Equivalent: Automation savings equal <span className="font-bold">{fteEquiv} FTEs</span> of your {apHeadcount}-person AP team
              </div>
            </Section>

            {/* F3: Store-Level Ops Recovery */}
            <Section title="F3: Store-Level Ops Recovery" subtitle="GM/receiver time recovered from invoice paperwork" active={true} result={f3Total}
              formulaExplanation={`${stores} stores × ${storeOpsHrs} hrs/wk × 52 weeks × $${gmRate}/hr = ${fmtFull(f3Total)}\n\nThat's ${(storeOpsHrs * 52).toLocaleString()} hours/year per store your managers get back for customer-facing work.`}>
              <NumInput label="Store Ops Hours / Week" tipId="store_ops_hours" value={storeOpsHrs} onChange={setStoreOpsHrs} min={2} max={12} suffix="hrs/store" />
              <NumInput label="GM Effective Hourly Rate" tipId="effective_gm_rate" value={gmRate} onChange={setGmRate} min={22} max={55} prefix="$" suffix="/hr" />
            </Section>

            {/* F4: Vendor Credit Recovery */}
            <Section title="F4: Vendor Credit & Allowance Recovery" subtitle="Uncaptured promotional discounts, stales/returns, short-ship credits" active={f4Active} result={f4Total}
              formulaExplanation={f4Active ? `$${vendorSpend.toLocaleString()} × ${(creditRate*100).toFixed(1)}% uncaptured × ${(creditImprove*100)}% improvement = ${fmtFull(f4Total)}` : null}>
              <NumInput label="Uncaptured Credit Rate" tipId="uncaptured_credit_rate" value={creditRate} onChange={setCreditRate} min={0.003} max={0.015} step={0.001} suffix={`(${(creditRate*100).toFixed(1)}%)`} />
              <NumInput label="Credit Catch Improvement" tipId="credit_catch_improvement" value={creditImprove} onChange={setCreditImprove} min={0.3} max={0.7} step={0.05} suffix={`(${(creditImprove*100)}%)`} />
            </Section>

            {/* F5: Month-End Close */}
            <Section title="F5: Month-End Close Efficiency" subtitle="Overtime and reconciliation reduction during the 'last 48 hours'" active={true} result={f5Total}
              formulaExplanation={`Overtime Savings: (${curOT} − ${autoOT}) hrs × 12 months × $${otRate}/hr = ${fmtFull((curOT - autoOT) * 12 * otRate)}\nReconciliation Savings: (${curRecon} − ${autoRecon}) hrs × 12 months × $${apRate}/hr = ${fmtFull((curRecon - autoRecon) * 12 * apRate)}\nTotal: ${fmtFull(f5Total)}`}>
              <NumInput label="Current Close OT Hours" tipId="current_close_ot" value={curOT} onChange={setCurOT} min={4} max={40} suffix="hrs/month" />
              <NumInput label="Automated Close OT Hours" tipId="automated_close_ot" value={autoOT} onChange={setAutoOT} min={0} max={10} suffix="hrs/month" />
              <NumInput label="OT Hourly Rate" tipId="ot_hourly_rate" value={otRate} onChange={setOtRate} min={27} max={68} prefix="$" suffix="/hr" />
              <NumInput label="Current Recon Hours" tipId="current_recon_hours" value={curRecon} onChange={setCurRecon} min={8} max={60} suffix="hrs/month" />
              <NumInput label="Automated Recon Hours" tipId="automated_recon_hours" value={autoRecon} onChange={setAutoRecon} min={2} max={15} suffix="hrs/month" />
            </Section>

            {/* F6: Multi-Store Scalability */}
            <Section title="F6: Multi-Store Scalability" subtitle="Avoided AP headcount for new store openings" active={true} result={f6Total}
              formulaExplanation={newStores > 0 ? `${avoidedFTE} FTE avoided × ${newStores} new stores × $${fteCost.toLocaleString()}/yr = ${fmtFull(f6Total)}` : "No new stores planned — this formula is not contributing to the total."}>
              <NumInput label="Avoided FTE / New Store" tipId="avoided_fte" value={avoidedFTE} onChange={setAvoidedFTE} min={0.15} max={0.5} step={0.05} />
              <NumInput label="New Stores / Year" tipId="planned_stores" value={newStores} onChange={setNewStores} min={0} max={10} />
              <NumInput label="Annual AP FTE Cost" tipId="annual_fte_cost" value={fteCost} onChange={setFteCost} min={38000} max={75000} prefix="$" />
            </Section>
          </div>

          {/* Right: Results Dashboard */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              {/* F7: TMDV Summary */}
              <div className="bg-slate-900 rounded-lg p-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">F7: Total Margin Defense Value</h2>
                  <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">Rollup</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-4">Sum of all active formulas minus Ottimate investment</p>
                
                <div className="space-y-2 mb-4">
                  {f1Active && <div className="flex justify-between text-xs"><span className="text-slate-400">F1 Pricing Variance</span><span className="text-emerald-400 font-semibold tabular-nums">{fmt(f1Total)}</span></div>}
                  <div className="flex justify-between text-xs"><span className="text-slate-400">F2 Invoice Processing</span><span className={`font-semibold tabular-nums ${f2Total >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(f2Total)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">F3 Store Ops Recovery</span><span className="text-emerald-400 font-semibold tabular-nums">{fmt(f3Total)}</span></div>
                  {f4Active && <div className="flex justify-between text-xs"><span className="text-slate-400">F4 Credit Recovery</span><span className="text-emerald-400 font-semibold tabular-nums">{fmt(f4Total)}</span></div>}
                  <div className="flex justify-between text-xs"><span className="text-slate-400">F5 Month-End Close</span><span className="text-emerald-400 font-semibold tabular-nums">{fmt(f5Total)}</span></div>
                  {f6Total > 0 && <div className="flex justify-between text-xs"><span className="text-slate-400">F6 Scalability</span><span className="text-emerald-400 font-semibold tabular-nums">{fmt(f6Total)}</span></div>}
                </div>

                <div className="border-t border-slate-700 pt-3 mb-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Gross TMDV</span><span className="text-white font-bold tabular-nums">{fmtFull(tmdv)}</span></div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Less: Ottimate Investment</span><span className="text-red-400 font-semibold tabular-nums">({fmtFull(annualCost + annualizedOnboard)})</span></div>
                </div>

                <div className="bg-slate-800 rounded-lg p-3 mb-4">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Net Annual Value</div>
                  <div className={`text-2xl font-black tabular-nums ${netAnnual >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtFull(netAnnual)}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-800 rounded p-2.5">
                    <div className="text-[10px] text-slate-400 uppercase">Payback</div>
                    <div className="text-lg font-bold text-white">{paybackMonths}<span className="text-xs font-normal text-slate-400"> mo</span></div>
                  </div>
                  <div className={`rounded p-2.5 ${ttvProfile.color === "emerald" ? "bg-emerald-900/40" : ttvProfile.color === "amber" ? "bg-amber-900/40" : "bg-red-900/40"}`}>
                    <div className="text-[10px] text-slate-400 uppercase">Time-to-Value</div>
                    <div className={`text-sm font-bold ${ttvProfile.color === "emerald" ? "text-emerald-400" : ttvProfile.color === "amber" ? "text-amber-400" : "text-red-400"}`}>{ttvProfile.label}</div>
                    <div className="text-[10px] text-slate-400">{ttvProfile.range}</div>
                  </div>
                </div>

                {/* Net Profit Multiplier */}
                <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-lg p-3 border border-blue-700/30">
                  <div className="text-[10px] text-blue-300 uppercase tracking-wider mb-1">Net Profit Multiplier</div>
                  <div className="text-lg font-black text-blue-300 tabular-nums">{fmtFull(multiplier)}</div>
                  <p className="text-[10px] text-blue-400 mt-1 leading-relaxed">
                    This recovery is equivalent to generating <span className="font-bold text-white">{fmtFull(multiplier)}</span> in new revenue at {(margin*100).toFixed(1)}% margins.
                  </p>
                </div>
              </div>

              {/* Time-to-Value Qualifier */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Time-to-Value Qualifier</h2>
                <SelectInput label="% Digital PDFs" tipId="pct_digital" value={pctDigital} onChange={setPctDigital}
                  options={[{ value: "high", label: "> 70% Digital" }, { value: "medium", label: "40-70% Digital" }, { value: "low", label: "< 40% Digital" }]} />
                <SelectInput label="Avg Line Items / Invoice" tipId="avg_line_items" value={avgLineItems} onChange={setAvgLineItems}
                  options={[{ value: "low", label: "< 50 line items" }, { value: "medium", label: "50-100 line items" }, { value: "high", label: "100+ line items" }]} />
                <SelectInput label="Data Quality" tipId="data_quality" value={dataQuality} onChange={setDataQuality}
                  options={[{ value: "clean", label: "Clean & maintained" }, { value: "moderate", label: "Some cleanup needed" }, { value: "messy", label: "Major cleanup needed" }]} />
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
