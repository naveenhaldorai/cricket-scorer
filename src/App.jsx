import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Analytics } from "@vercel/analytics/react";

const SAVE_KEY = "cricket_scorer_v1";
const loadSaved = () => { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
const saveState = (s) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {} };
const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch {} };

// ── Design Tokens ─────────────────────────────────────────────────────────
const C = {
  bg:       "#080c10",
  surface:  "#0f1620",
  card:     "#141d2b",
  border:   "#1e2d42",
  accent:   "#f0b429",   // gold
  accentLo: "#f0b42922",
  red:      "#e53e3e",
  redLo:    "#e53e3e22",
  green:    "#38a169",
  greenLo:  "#38a16922",
  blue:     "#4299e1",
  blueLo:   "#4299e122",
  text:     "#e8edf2",
  muted:    "#6b7c93",
  dim:      "#2d3d52",
};

// ── Helpers ───────────────────────────────────────────────────────────────
const bToO = b => `${Math.floor(b / 6)}.${b % 6}`;
const calcRR = (r, b) => b === 0 ? "0.00" : (r / (b / 6)).toFixed(2);
const dc = o => JSON.parse(JSON.stringify(o));
const mkBat = n => ({ name: n, runs: 0, balls: 0, fours: 0, sixes: 0, dismissed: false, dismissal: "", bowler: "", retired: false });
const mkBwl = n => ({ name: n, legalBalls: 0, maidens: 0, runs: 0, wickets: 0 });
const blankInn = (bat, bowl) => ({
  battingTeam: bat, bowlingTeam: bowl, runs: 0, wickets: 0, balls: 0,
  batsmen: [], bowlers: [], bowlerIdx: 0, striker: 0, nonStriker: 1,
  overHistory: [], curOverBalls: [], curOverBowlerRuns: 0,
  extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 },
  fow: [], partnerships: [],
  curPartnership: { runs: 0, balls: 0, bat1Idx: 0, bat2Idx: 1 },
  wormData: [{ over: 0, runs: 0 }], target: null,
});

// ── Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const saved = loadSaved();
  const [scr, setScr] = useState(saved?.scr || "setup");
  const [cfg, setCfg] = useState(saved?.cfg || { host: "", visitor: "", overs: "20", ppt: "11", nb: { on: true, reball: true, run: 1 }, wb: { on: true, reball: true, run: 1 } });
  const [inn, setInn] = useState(saved?.inn || [null, null]);
  const [ci, setCi] = useState(saved?.ci || 0);
  const [prevInn, setPrevInn] = useState(null);
  const [open, setOpen] = useState({ striker: "", nonStriker: "", bowler: "" });
  const [mods, setMods] = useState({ wide: false, noBall: false, byes: false, legByes: false, wicket: false });
  const [showWk, setShowWk] = useState(false);
  const [showBwl, setShowBwl] = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showRetire, setShowRetire] = useState(false);
  const [pendRun, setPendRun] = useState(0);
  const [wkForm, setWkForm] = useState({ type: "Bowled", fielder: "", newBat: "", dismissed: 0 });
  const [retireForm, setRetireForm] = useState({ batIdx: 0, newBat: "" });
  const [bwlName, setBwlName] = useState("");
  const [stab, setStab] = useState("scoreboard");
  const [atab, setAtab] = useState("worm");
  const [ixp, setIxp] = useState([false, true]);
  const [toss, setToss] = useState(saved?.toss || { flipping: false, flipped: false, result: "", call: "", caller: "host", winner: "host", elected: "bat" });

  // Autosave whenever key match state changes
  useEffect(() => {
    if (scr !== "setup") saveState({ scr, cfg, inn, ci, toss });
  }, [scr, cfg, inn, ci, toss]);

  const handleNewMatch = () => {
    clearSave();
    setScr("setup"); setCfg({ host: "", visitor: "", overs: "20", ppt: "11", nb: { on: true, reball: true, run: 1 }, wb: { on: true, reball: true, run: 1 } });
    setInn([null, null]); setCi(0); setPrevInn(null); setOpen({ striker: "", nonStriker: "", bowler: "" });
    setToss({ flipping: false, flipped: false, result: "", call: "", caller: "host", winner: "host", elected: "bat" });
  };

  const hn = () => cfg.host || "Host Team";
  const vn = () => cfg.visitor || "Visitor Team";
  const getBatFirst = () => { const w = toss.winner === "host" ? hn() : vn(); return toss.elected === "bat" ? w : (w === hn() ? vn() : hn()); };

  const flipCoin = () => {
    if (!toss.call || toss.flipping || toss.flipped) return;
    setToss(t => ({ ...t, flipping: true }));
    setTimeout(() => {
      const result = Math.random() < 0.5 ? "heads" : "tails";
      const callWon = result === toss.call;
      const winner = callWon ? toss.caller : (toss.caller === "host" ? "visitor" : "host");
      setToss(t => ({ ...t, flipping: false, flipped: true, result, winner }));
    }, 1800);
  };

  const resetMods = () => setMods({ wide: false, noBall: false, byes: false, legByes: false, wicket: false });

  const startMatch = () => {
    const batTeam = getBatFirst(), bwlTeam = batTeam === hn() ? vn() : hn();
    const i = blankInn(batTeam, bwlTeam);
    i.batsmen = [mkBat(open.striker || "Player 1"), mkBat(open.nonStriker || "Player 2")];
    i.bowlers = [mkBwl(open.bowler || "Bowler 1")];
    i.curPartnership = { runs: 0, balls: 0, bat1Idx: 0, bat2Idx: 1 };
    setInn([i, null]); setCi(0); setPrevInn(null); resetMods(); setScr("scoring");
  };

  const startInn2 = () => {
    setInn(prev => {
      const arr = [prev[0] ? dc(prev[0]) : null, prev[1] ? dc(prev[1]) : null];
      const i = arr[1];
      i.batsmen = [mkBat(open.striker || "Player 1"), mkBat(open.nonStriker || "Player 2")];
      i.bowlers = [mkBwl(open.bowler || "Bowler 1")];
      i.curPartnership = { runs: 0, balls: 0, bat1Idx: 0, bat2Idx: 1 };
      return arr;
    });
    setPrevInn(null); resetMods(); setScr("scoring");
  };

  const handleUndo = () => { if (!prevInn) return; setInn(prevInn); setPrevInn(null); resetMods(); };

  const openRetire = () => {
    const cur = inn[ci]; if (!cur) return;
    setRetireForm({ batIdx: cur.striker, newBat: "" }); setShowRetire(true);
  };

  const confirmRetire = () => {
    if (!retireForm.newBat.trim()) return;
    setInn(prev => {
      const arr = [prev[0] ? dc(prev[0]) : null, prev[1] ? dc(prev[1]) : null];
      const i = arr[ci];
      const old = i.batsmen[retireForm.batIdx];
      i.partnerships = [...i.partnerships, { runs: i.curPartnership.runs, balls: i.curPartnership.balls, bat1: i.batsmen[i.curPartnership.bat1Idx]?.name || "", bat2: i.batsmen[i.curPartnership.bat2Idx]?.name || "", reason: `${old.name} retired` }];
      i.batsmen[retireForm.batIdx] = { ...old, retired: true, dismissal: "retired" };
      i.batsmen[retireForm.batIdx] = mkBat(retireForm.newBat.trim());
      i.curPartnership = { runs: 0, balls: 0, bat1Idx: i.striker, bat2Idx: i.nonStriker };
      return arr;
    });
    setShowRetire(false);
  };

  const handleRunBtn = (run) => {
    const cur = inn[ci]; if (!cur) return;
    if (mods.wicket) { setPendRun(run); setWkForm({ type: "Bowled", fielder: "", newBat: "", dismissed: cur.striker }); setShowWk(true); return; }
    applyBall(run, null, { ...mods });
  };

  const applyBall = (run, wkData, cm) => {
    setPrevInn([inn[0] ? dc(inn[0]) : null, inn[1] ? dc(inn[1]) : null]);
    const curMods = cm || { ...mods };
    const newInn = [inn[0] ? dc(inn[0]) : null, inn[1] ? dc(inn[1]) : null];
    const i = newInn[ci]; if (!i) return;
    const bowler = i.bowlers[i.bowlerIdx];
    const isWide = curMods.wide && cfg.wb.on, isNB = curMods.noBall && cfg.nb.on;
    const isBye = curMods.byes, isLB = curMods.legByes, isWkt = !!wkData;
    const isLegal = !isWide && !(isNB && cfg.nb.reball);
    const wideExtra = isWide ? (cfg.wb.run || 1) : 0, nbExtra = isNB ? (cfg.nb.run || 1) : 0;
    const totalRuns = run + wideExtra + nbExtra;
    i.runs += totalRuns;
    if (!isWide && !isBye && !isLB) { i.batsmen[i.striker].runs += run; if (run === 4) i.batsmen[i.striker].fours++; if (run === 6) i.batsmen[i.striker].sixes++; }
    if (isWide) i.extras.wide += wideExtra + run;
    if (isNB) i.extras.noBall += nbExtra;
    if (isBye) i.extras.bye += run;
    if (isLB) i.extras.legBye += run;
    if (isLegal) { i.balls++; i.batsmen[i.striker].balls++; if (bowler) bowler.legalBalls++; i.curPartnership.balls++; }
    i.curPartnership.runs += run;
    if (bowler) { bowler.runs += totalRuns; i.curOverBowlerRuns += totalRuns; }
    let display = String(run), ballType = "normal";
    if (isWide) { display = run > 0 ? `Wd+${run}` : "Wd"; ballType = "wide"; }
    else if (isNB) { display = run > 0 ? `NB+${run}` : "NB"; ballType = "nb"; }
    else if (isBye && run > 0) { display = `B${run}`; ballType = "bye"; }
    else if (isLB && run > 0) { display = `LB${run}`; ballType = "lb"; }
    else if (run === 4) ballType = "four";
    else if (run === 6) ballType = "six";
    if (isWkt) { display = "W"; ballType = "wicket"; }
    i.curOverBalls = [...i.curOverBalls, { display, run: totalRuns, type: ballType }];
    if (!isWkt && !isWide && run % 2 === 1) { const t = i.striker; i.striker = i.nonStriker; i.nonStriker = t; }
    if (isWkt && wkData) {
      const { type: wt, fielder, newBat, dismissed } = wkData;
      const bn = bowler?.name || "";
      const dis = wt === "Bowled" ? `b ${bn}` : wt === "Caught" ? `c ${fielder} b ${bn}` : wt === "LBW" ? `lbw b ${bn}` : wt === "Run Out" ? `run out (${fielder})` : wt === "Stumped" ? `st ${fielder} b ${bn}` : wt;
      const old = i.batsmen[dismissed];
      i.batsmen[dismissed] = { ...old, dismissed: true, dismissal: dis, bowler: bn };
      i.wickets++;
      if (bowler && ["Bowled", "Caught", "LBW", "Stumped"].includes(wt)) bowler.wickets++;
      i.fow = [...i.fow, { wk: i.wickets, runs: i.runs, overs: bToO(i.balls), bat: old.name }];
      i.partnerships = [...i.partnerships, { runs: i.curPartnership.runs, balls: i.curPartnership.balls, bat1: i.batsmen[i.curPartnership.bat1Idx]?.name || "", bat2: i.batsmen[i.curPartnership.bat2Idx]?.name || "", reason: `${old.name} out` }];
      if (newBat) { i.batsmen[dismissed] = mkBat(newBat); i.curPartnership = { runs: 0, balls: 0, bat1Idx: i.striker, bat2Idx: i.nonStriker }; }
    }
    const overComplete = isLegal && i.balls > 0 && i.balls % 6 === 0;
    if (overComplete) {
      if (bowler && i.curOverBowlerRuns === 0) bowler.maidens++;
      const ovNum = Math.floor(i.balls / 6);
      i.overHistory = [...i.overHistory, { overNum: ovNum, bowler: bowler?.name || "", bat1: i.batsmen[i.striker]?.name || "", bat2: i.batsmen[i.nonStriker]?.name || "", balls: [...i.curOverBalls], runs: i.curOverBalls.reduce((s, b) => s + b.run, 0) }];
      i.wormData = [...i.wormData, { over: ovNum, runs: i.runs }];
      i.curOverBalls = []; i.curOverBowlerRuns = 0;
      const t = i.striker; i.striker = i.nonStriker; i.nonStriker = t;
    }
    newInn[ci] = i;
    const inningsOver = i.balls >= parseInt(cfg.overs) * 6 || i.wickets >= 10;
    resetMods();
    if (inningsOver) {
      if (ci === 0) { const i2 = blankInn(i.bowlingTeam, i.battingTeam); i2.target = i.runs + 1; newInn[1] = i2; setInn(newInn); setCi(1); setPrevInn(null); setOpen({ striker: "", nonStriker: "", bowler: "" }); setScr("opening"); }
      else { setInn(newInn); setPrevInn(null); setScr("scoreboard"); setStab("scoreboard"); setIxp([true, true]); }
    } else { setInn(newInn); if (overComplete) setTimeout(() => setShowBwl(true), 50); }
  };

  const confirmWicket = () => { applyBall(pendRun, { ...wkForm }, { ...mods, wicket: false }); setShowWk(false); };
  const confirmBowler = () => {
    if (!bwlName.trim()) return;
    setInn(prev => {
      const arr = [prev[0] ? dc(prev[0]) : null, prev[1] ? dc(prev[1]) : null];
      const i = arr[ci]; const ex = i.bowlers.findIndex(b => b.name === bwlName.trim());
      if (ex >= 0) i.bowlerIdx = ex; else { i.bowlers = [...i.bowlers, mkBwl(bwlName.trim())]; i.bowlerIdx = i.bowlers.length - 1; }
      return arr;
    });
    setBwlName(""); setShowBwl(false);
  };
  const swapBatsmen = () => {
    setInn(prev => { const arr = [prev[0] ? dc(prev[0]) : null, prev[1] ? dc(prev[1]) : null]; const i = arr[ci]; const t = i.striker; i.striker = i.nonStriker; i.nonStriker = t; return arr; });
  };
  const getResult = () => {
    if (!inn[0] || !inn[1]) return "";
    const i2 = inn[1], i1 = inn[0];
    if (i2.runs >= (i2.target || 0)) return `${i2.battingTeam} won by ${10 - i2.wickets} wicket${10 - i2.wickets !== 1 ? "s" : ""}`;
    const diff = (i2.target || 0) - 1 - i2.runs;
    if (diff === 0) return "Match Tied!";
    return `${i1.battingTeam} won by ${diff} run${diff !== 1 ? "s" : ""}`;
  };

  const cur = inn[ci];
  const i1n = inn[0]?.battingTeam || hn();
  const i2n = inn[0]?.bowlingTeam || vn();

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.bg, color: C.text, minHeight: "100vh", maxWidth: 430, margin: "0 auto", position: "relative", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Barlow+Condensed:wght@600;700;800&family=Rajdhani:wght@600;700&display=swap" rel="stylesheet" />
      {scr === "setup"      && <SetupScr cfg={cfg} setCfg={setCfg} onSettings={() => setScr("settings")} onNext={() => setScr("toss")} hasSaved={!!saved} onResume={() => setScr(saved.scr)} />}
      {scr === "settings"   && <SettingsScr cfg={cfg} setCfg={setCfg} onBack={() => setScr("setup")} />}
      {scr === "toss"       && <TossScr toss={toss} setToss={setToss} onFlip={flipCoin} onContinue={() => setScr("opening")} hn={hn()} vn={vn()} />}
      {scr === "opening"    && <OpeningScr open={open} setOpen={setOpen} onStart={ci === 0 ? startMatch : startInn2} ci={ci} batTeam={ci === 0 ? getBatFirst() : (inn[1]?.battingTeam || "")} onBack={() => setScr(ci === 0 ? "toss" : "scoring")} />}
      {scr === "scoring"    && cur && <ScoringScr cfg={cfg} inn={inn} ci={ci} cur={cur} mods={mods} setMods={setMods} onRun={handleRunBtn} onSwap={swapBatsmen} onUndo={prevInn ? handleUndo : null} onPartner={() => setShowPartner(true)} onExtras={() => setShowExtras(true)} onRetire={openRetire} onScoreboard={() => { setScr("scoreboard"); setStab("scoreboard"); }} onAnalysis={() => setScr("analysis")} onNewMatch={handleNewMatch} />}
      {scr === "scoreboard" && <ScoreboardScr inn={inn} stab={stab} setStab={setStab} ixp={ixp} setIxp={setIxp} result={getResult()} onBack={() => setScr("scoring")} onAnalysis={() => setScr("analysis")} i1n={i1n} i2n={i2n} onNewMatch={handleNewMatch} />}
      {scr === "analysis"   && <AnalysisScr inn={inn} atab={atab} setAtab={setAtab} onBack={() => setScr("scoreboard")} i1n={i1n} i2n={i2n} />}
      {showWk   && cur && <WicketModal cur={cur} form={wkForm} setForm={setWkForm} onConfirm={confirmWicket} onClose={() => setShowWk(false)} />}
      {showBwl  && <BowlerScr name={bwlName} setName={setBwlName} onDone={confirmBowler} onBack={() => setShowBwl(false)} />}
      {showPartner && cur && <PartnershipsModal cur={cur} onClose={() => setShowPartner(false)} />}
      {showExtras  && cur && <ExtrasModal cur={cur} onClose={() => setShowExtras(false)} />}
      {showRetire  && cur && <RetireModal cur={cur} form={retireForm} setForm={setRetireForm} onConfirm={confirmRetire} onClose={() => setShowRetire(false)} />}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, button { font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.dim}; border-radius: 2px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fadeIn { animation: fadeIn 0.25s ease forwards; }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .slideUp { animation: slideUp 0.3s cubic-bezier(.22,.68,0,1.2) forwards; }
        button:active { transform: scale(0.96); }
        .coin-wrap { perspective: 600px; width: 150px; height: 150px; }
        .coin-inner { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform 0.05s; }
        .coin-inner.flip-heads { animation: flipToHeads 1.8s ease-in-out forwards; }
        .coin-inner.flip-tails { animation: flipToTails 1.8s ease-in-out forwards; }
        .coin-inner.show-heads { transform: rotateY(0deg); }
        .coin-inner.show-tails { transform: rotateY(180deg); }
        @keyframes flipToHeads { 0%{transform:rotateY(0deg) scale(1)} 40%{transform:rotateY(900deg) scale(1.3)} 80%{transform:rotateY(1060deg) scale(1.1)} 100%{transform:rotateY(1080deg) scale(1)} }
        @keyframes flipToTails { 0%{transform:rotateY(0deg) scale(1)} 40%{transform:rotateY(900deg) scale(1.3)} 80%{transform:rotateY(1240deg) scale(1.1)} 100%{transform:rotateY(1260deg) scale(1)} }
        .coin-face { position: absolute; width: 100%; height: 100%; border-radius: 50%; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: flex; align-items: center; justify-content: center; }
        .coin-heads { background: radial-gradient(circle at 35% 30%, #fff5c0, #d4a017 45%, #8a6200 80%, #5a4000); box-shadow: inset -6px -6px 14px rgba(0,0,0,0.5), inset 4px 4px 10px rgba(255,255,200,0.4), 0 0 30px #f0b42966; border: 3px solid #c8920044; }
        .coin-tails { background: radial-gradient(circle at 65% 30%, #fff5c0, #d4a017 45%, #8a6200 80%, #5a4000); box-shadow: inset 6px -6px 14px rgba(0,0,0,0.5), inset -4px 4px 10px rgba(255,255,200,0.4), 0 0 30px #f0b42966; border: 3px solid #c8920044; transform: rotateY(180deg); }
      `}</style>
      <Analytics />
    </div>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────
const TopBar = ({ left, center, right }) => (
  <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12 }}>
    {left && <div style={{ flexShrink: 0 }}>{left}</div>}
    <div style={{ flex: 1, textAlign: left && right ? "center" : "left" }}>{center}</div>
    {right && <div style={{ flexShrink: 0 }}>{right}</div>}
  </div>
);
const BackBtn = ({ onClick }) => (
  <button onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, width: 36, height: 36, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
);
const GoldLabel = ({ children }) => (
  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, marginTop: 20 }}>{children}</div>
);
const Surface = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", ...style }}>{children}</div>
);
const DarkInput = ({ placeholder, value, onChange, type = "text" }) => (
  <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 15, outline: "none", marginBottom: 10 }} />
);
const RadioPill = ({ options, value, onChange, disabled }) => (
  <div style={{ display: "flex", gap: 8, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
    {options.map(o => (
      <button key={o.val} onClick={() => !disabled && onChange(o.val)} disabled={disabled} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `1px solid ${value === o.val ? C.accent : C.border}`, background: value === o.val ? C.accentLo : C.surface, color: value === o.val ? C.accent : C.muted, fontSize: 14, fontWeight: value === o.val ? 700 : 400, cursor: disabled ? "not-allowed" : "pointer", transition: "all .15s" }}>{o.label}</button>
    ))}
  </div>
);
const Toggle = ({ on, onChange }) => (
  <div onClick={() => onChange(!on)} style={{ width: 46, height: 26, borderRadius: 13, background: on ? C.accent : C.dim, cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
    <div style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 20, height: 20, borderRadius: "50%", background: on ? C.bg : C.muted, transition: "left .2s" }} />
  </div>
);
const GoldBtn = ({ children, onClick, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "15px 0", background: disabled ? C.dim : C.accent, color: disabled ? C.muted : C.bg, border: "none", borderRadius: 12, fontSize: 16, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: 1, cursor: disabled ? "not-allowed" : "pointer", ...style }}>{children}</button>
);
const Pill = ({ b }) => {
  const map = { wicket: [C.red, "#fff"], six: [C.accent, C.bg], four: ["#dd6b20", "#fff"], wide: [C.blue, "#fff"], nb: ["#805ad5", "#fff"], bye: [C.dim, C.muted], lb: [C.dim, C.muted], normal: [C.surface, C.muted] };
  const [bg, col] = map[b.type] || map.normal;
  return <div style={{ width: 32, height: 32, borderRadius: "50%", background: bg, color: col, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{b.display}</div>;
};
const Sheet = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 400, display: "flex", flexDirection: "column" }}>
    <div style={{ flex: 1 }} onClick={onClose} />
    <div className="slideUp" style={{ background: C.surface, borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto", border: `1px solid ${C.border}`, borderBottom: "none" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px 18px 8px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5, flex: 1 }}>{title}</div>
        <button onClick={onClose} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>
      <div style={{ padding: "16px 18px 32px" }}>{children}</div>
    </div>
  </div>
);
const TabRow = ({ tabs, active, onSelect }) => (
  <div style={{ display: "flex", gap: 4, padding: "0 16px 12px" }}>
    {tabs.map(t => (
      <button key={t.val} onClick={() => onSelect(t.val)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${active === t.val ? C.accent : C.border}`, background: active === t.val ? C.accentLo : C.card, color: active === t.val ? C.accent : C.muted, fontSize: 13, fontWeight: active === t.val ? 700 : 400, cursor: "pointer" }}>{t.label}</button>
    ))}
  </div>
);

// ── Setup ─────────────────────────────────────────────────────────────────
function SetupScr({ cfg, setCfg, onSettings, onNext, hasSaved, onResume }) {
  return (
    <div className="fadeIn" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(160deg, #0f1e35 0%, ${C.bg} 100%)`, padding: "40px 20px 28px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Live Cricket</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42, fontWeight: 800, lineHeight: 1, color: C.text }}>MATCH<br /><span style={{ color: C.accent }}>SCORER</span></div>
      </div>

      <div style={{ flex: 1, padding: "4px 16px 100px" }}>
        {/* Resume banner */}
        {hasSaved && (
          <div className="fadeIn" style={{ marginTop: 16, background: C.accentLo, border: `1px solid ${C.accent}55`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: C.accent, letterSpacing: 0.5 }}>MATCH IN PROGRESS</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>You have an unfinished match</div>
            </div>
            <button onClick={onResume} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}>RESUME →</button>
          </div>
        )}
        <GoldLabel>Teams</GoldLabel>
        <Surface>
          <DarkInput placeholder="Host Team" value={cfg.host} onChange={v => setCfg(c => ({ ...c, host: v }))} />
          <DarkInput placeholder="Visitor Team" value={cfg.visitor} onChange={v => setCfg(c => ({ ...c, visitor: v }))} />
        </Surface>
        <GoldLabel>Overs</GoldLabel>
        <DarkInput placeholder="20" value={cfg.overs} type="number" onChange={v => setCfg(c => ({ ...c, overs: v }))} />
      </div>

      {/* Sticky bottom */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: `${C.bg}ee`, backdropFilter: "blur(12px)", padding: "12px 16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
        <button onClick={onSettings} style={{ flex: 1, padding: "14px 0", background: C.card, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>⚙ Settings</button>
        <GoldBtn style={{ flex: 2 }} onClick={onNext}>NEW MATCH →</GoldBtn>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────
function SettingsScr({ cfg, setCfg, onBack }) {
  return (
    <div className="fadeIn">
      <TopBar left={<BackBtn onClick={onBack} />} center={<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>MATCH SETTINGS</span>} />
      <div style={{ padding: "0 16px 40px" }}>
        <GoldLabel>Players per team</GoldLabel>
        <DarkInput placeholder="11" value={cfg.ppt} type="number" onChange={v => setCfg(c => ({ ...c, ppt: v }))} />
        <GoldLabel>No Ball Rules</GoldLabel>
        <Surface>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14 }}>Enable No Ball</span><Toggle on={cfg.nb.on} onChange={v => setCfg(c => ({ ...c, nb: { ...c.nb, on: v } }))} /></div>
          {cfg.nb.on && <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14, color: C.muted }}>Re-ball</span><Toggle on={cfg.nb.reball} onChange={v => setCfg(c => ({ ...c, nb: { ...c.nb, reball: v } }))} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 14, color: C.muted }}>Penalty runs</span><input type="number" value={cfg.nb.run} onChange={e => setCfg(c => ({ ...c, nb: { ...c.nb, run: parseInt(e.target.value) || 1 } }))} style={{ width: 60, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "6px 10px", fontSize: 15, outline: "none", textAlign: "center" }} /></div>
          </>}
        </Surface>
        <GoldLabel>Wide Ball Rules</GoldLabel>
        <Surface>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14 }}>Enable Wide Ball</span><Toggle on={cfg.wb.on} onChange={v => setCfg(c => ({ ...c, wb: { ...c.wb, on: v } }))} /></div>
          {cfg.wb.on && <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14, color: C.muted }}>Re-ball</span><Toggle on={cfg.wb.reball} onChange={v => setCfg(c => ({ ...c, wb: { ...c.wb, reball: v } }))} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 14, color: C.muted }}>Penalty runs</span><input type="number" value={cfg.wb.run} onChange={e => setCfg(c => ({ ...c, wb: { ...c.wb, run: parseInt(e.target.value) || 1 } }))} style={{ width: 60, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "6px 10px", fontSize: 15, outline: "none", textAlign: "center" }} /></div>
          </>}
        </Surface>
        <div style={{ marginTop: 28 }}><GoldBtn onClick={onBack}>SAVE SETTINGS</GoldBtn></div>
      </div>
    </div>
  );
}

// ── Toss ──────────────────────────────────────────────────────────────────
function TossScr({ toss, setToss, onFlip, onContinue, hn, vn }) {
  const winnerName = toss.flipped ? (toss.winner === "host" ? hn : vn) : "";
  return (
    <div className="fadeIn">
      <TopBar left={<BackBtn onClick={() => { }} />} center={<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>COIN TOSS</span>} />
      <div style={{ padding: "0 16px 100px" }}>
        <GoldLabel>Who called the toss?</GoldLabel>
        <RadioPill options={[{ val: "host", label: hn }, { val: "visitor", label: vn }]} value={toss.caller} onChange={v => setToss(t => ({ ...t, caller: v }))} disabled={toss.flipping || toss.flipped} />
        <GoldLabel>Called</GoldLabel>
        <RadioPill options={[{ val: "heads", label: "👑 Heads" }, { val: "tails", label: "🏏 Tails" }]} value={toss.call} onChange={v => setToss(t => ({ ...t, call: v }))} disabled={toss.flipping || toss.flipped} />

        {/* Coin */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "36px 0 28px" }}>
          <div className="coin-wrap">
            <div className={`coin-inner ${toss.flipping ? (toss.result === "heads" ? "flip-heads" : "flip-tails") : toss.flipped ? (toss.result === "heads" ? "show-heads" : "show-tails") : "show-heads"}`}>
              {/* HEADS — Lion Capital (real photo) */}
              <div className="coin-face coin-heads" style={{ overflow: "hidden" }}>
                <img src="data:image/png;base64,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" alt="heads" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              </div>

              {/* TAILS — 1 Rupee reverse (real photo) */}
              <div className="coin-face coin-tails" style={{ overflow: "hidden" }}>
                <img src="data:image/png;base64,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" alt="tails" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", transform: "rotateY(180deg) scaleX(-1)" }} />
              </div>
            </div>
          </div>
          {toss.flipped && (
            <div className="fadeIn" style={{ marginTop: 20, textAlign: "center" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, color: C.accent }}>{toss.result === "heads" ? "HEADS!" : "TAILS!"}</div>
              <div style={{ fontSize: 15, color: C.muted, marginTop: 4 }}>🎉 <b style={{ color: C.text }}>{winnerName}</b> won the toss</div>
            </div>
          )}
        </div>

        {!toss.flipped
          ? <GoldBtn onClick={onFlip} style={{ opacity: toss.call ? 1 : 0.4 }}>FLIP COIN 🪙</GoldBtn>
          : <div className="fadeIn">
            <GoldLabel>Elected to</GoldLabel>
            <RadioPill options={[{ val: "bat", label: "Bat" }, { val: "bowl", label: "Bowl" }]} value={toss.elected} onChange={v => setToss(t => ({ ...t, elected: v }))} />
            <div style={{ background: C.accentLo, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "10px 14px", margin: "16px 0", fontSize: 14, color: C.accent }}>
              🏏 <b>{winnerName}</b> will <b>{toss.elected}</b> first
            </div>
            <GoldBtn onClick={onContinue}>CONTINUE →</GoldBtn>
          </div>
        }
      </div>
    </div>
  );
}

// ── Opening Players ───────────────────────────────────────────────────────
function OpeningScr({ open, setOpen, onStart, ci, batTeam, onBack }) {
  return (
    <div className="fadeIn">
      <TopBar left={<BackBtn onClick={onBack} />} center={<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>OPENING LINEUP</span>} />
      <div style={{ padding: "0 16px 40px" }}>
        {batTeam && <div style={{ background: C.accentLo, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "10px 14px", marginBottom: 4, fontSize: 14, color: C.accent }}>🏏 {batTeam} batting {ci === 1 ? "(2nd innings)" : "first"}</div>}
        <GoldLabel>Striker</GoldLabel>
        <DarkInput placeholder="Player name" value={open.striker} onChange={v => setOpen(o => ({ ...o, striker: v }))} />
        <GoldLabel>Non-striker</GoldLabel>
        <DarkInput placeholder="Player name" value={open.nonStriker} onChange={v => setOpen(o => ({ ...o, nonStriker: v }))} />
        <GoldLabel>Opening Bowler</GoldLabel>
        <DarkInput placeholder="Player name" value={open.bowler} onChange={v => setOpen(o => ({ ...o, bowler: v }))} />
        <div style={{ marginTop: 24 }}><GoldBtn onClick={onStart}>START MATCH →</GoldBtn></div>
      </div>
    </div>
  );
}

// ── Scoring ───────────────────────────────────────────────────────────────
function ScoringScr({ cfg, inn, ci, cur, mods, setMods, onRun, onSwap, onUndo, onPartner, onExtras, onRetire, onScoreboard, onAnalysis, onNewMatch }) {
  const bowler = cur.bowlers[cur.bowlerIdx];
  const striker = cur.batsmen[cur.striker];
  const nonStriker = cur.batsmen[cur.nonStriker];
  const totalOvers = parseInt(cfg.overs) || 20;
  const ballsLeft = totalOvers * 6 - cur.balls;
  const i1n = inn[0]?.battingTeam || "";
  const i2n = inn[0]?.bowlingTeam || "";

  const toggleMod = k => setMods(m => {
    const n = { ...m, [k]: !m[k] };
    if (k === "wide" && n.wide) n.noBall = false;
    if (k === "noBall" && n.noBall) n.wide = false;
    return n;
  });

  const ModChip = ({ k, label }) => (
    <button onClick={() => toggleMod(k)} style={{ padding: "7px 12px", borderRadius: 20, border: `1px solid ${mods[k] ? C.accent : C.border}`, background: mods[k] ? C.accentLo : C.card, color: mods[k] ? C.accent : C.muted, fontSize: 12, fontWeight: mods[k] ? 700 : 400, cursor: "pointer", transition: "all .15s" }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(180deg, #0f1e35 0%, ${C.bg} 100%)`, padding: "12px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <BackBtn onClick={onScoreboard} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 1, color: C.muted }}>{i1n} <span style={{ color: C.dim }}>vs</span> {i2n}</div>
          </div>
          <button onClick={onAnalysis} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 16 }}>〜</button>
        </div>

        {/* BIG SCORE */}
        <div style={{ textAlign: "center", paddingBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{cur.battingTeam} · {ci + 1}{ci === 0 ? "st" : "nd"} Innings</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 80, fontWeight: 800, lineHeight: 1, letterSpacing: -1 }}>
            <span style={{ color: C.text }}>{cur.runs}</span>
            <span style={{ color: C.dim, fontWeight: 600 }}>/</span>
            <span style={{ color: C.red }}>{cur.wickets}</span>
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 600, color: C.muted, marginTop: 2 }}>({bToO(cur.balls)} ov)</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>CRR</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: C.accent }}>{calcRR(cur.runs, cur.balls)}</div>
            </div>
            {cur.target && <>
              <div style={{ width: 1, background: C.border }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>Need</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: C.red }}>{cur.target - cur.runs} off {ballsLeft}b</div>
              </div>
              <div style={{ width: 1, background: C.border }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>RRR</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: C.red }}>{calcRR(Math.max(0, cur.target - cur.runs), ballsLeft)}</div>
              </div>
            </>}
          </div>
        </div>

        {/* This Over pills */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 0 14px", display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, letterSpacing: 0.5 }}>THIS OVER</span>
          {cur.curOverBalls.map((b, i) => <Pill key={i} b={b} />)}
          {Array(Math.max(0, 6 - cur.curOverBalls.filter(b => b.type !== "wide" && b.type !== "nb").length)).fill(0).map((_, i) => (
            <div key={`e${i}`} style={{ width: 32, height: 32, borderRadius: "50%", border: `1px dashed ${C.dim}`, flexShrink: 0 }} />
          ))}
        </div>
      </div>

      {/* Players mini card */}
      <div style={{ padding: "10px 16px 0" }}>
        <Surface style={{ padding: "10px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: "0 10px", fontSize: 12, color: C.muted, marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
            <span>Batsman</span><span>R</span><span>B</span><span>4s</span><span>6s</span><span>SR</span>
          </div>
          {[{ b: striker, star: true }, { b: nonStriker, star: false }].map(({ b, star }, idx) => b && (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: "0 10px", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: star ? C.accent : C.text, fontWeight: star ? 700 : 400 }}>{b.name}{star ? "*" : ""}</span>
              <span style={{ fontWeight: 700 }}>{b.runs}</span><span style={{ color: C.muted }}>{b.balls}</span>
              <span>{b.fours}</span><span>{b.sixes}</span>
              <span style={{ color: C.muted }}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : 0}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: "0 10px", fontSize: 12, color: C.muted, marginBottom: 6 }}>
            <span>Bowler</span><span>O</span><span>M</span><span>R</span><span>W</span><span>ER</span>
          </div>
          {bowler && <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: "0 10px", fontSize: 13 }}>
            <span style={{ color: C.blue }}>{bowler.name}</span>
            <span>{Math.floor(bowler.legalBalls / 6)}.{bowler.legalBalls % 6}</span>
            <span>{bowler.maidens}</span><span>{bowler.runs}</span>
            <span style={{ color: bowler.wickets > 0 ? C.accent : C.text, fontWeight: bowler.wickets > 0 ? 700 : 400 }}>{bowler.wickets}</span>
            <span style={{ color: C.muted }}>{bowler.legalBalls > 0 ? (bowler.runs / (bowler.legalBalls / 6)).toFixed(1) : "-"}</span>
          </div>}
          {/* Partnership */}
          <div style={{ marginTop: 10, padding: "6px 10px", background: C.surface, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.muted }}>🤝 Partnership</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{cur.curPartnership?.runs || 0} <span style={{ color: C.muted, fontWeight: 400 }}>({cur.curPartnership?.balls || 0}b)</span></span>
            <button onClick={onPartner} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>All →</button>
          </div>
        </Surface>
      </div>

      {/* Modifier chips */}
      <div style={{ padding: "10px 16px 6px", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[["wide", "Wide"], ["noBall", "No Ball"], ["byes", "Byes"], ["legByes", "Leg Bye"], ["wicket", "🏏 WICKET"]].map(([k, l]) => (
          <ModChip key={k} k={k} label={l} />
        ))}
        <button onClick={onSwap} style={{ padding: "7px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 12, cursor: "pointer" }}>⇄ Swap</button>
        <button onClick={onRetire} style={{ padding: "7px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 12, cursor: "pointer" }}>Retire</button>
      </div>

      {/* Run Buttons */}
      <div style={{ padding: "6px 16px", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[0, 1, 2, 3, 4, 5, 6].map(r => (
            <button key={r} onClick={() => onRun(r)} style={{ aspectRatio: "1.2", borderRadius: 14, fontSize: 26, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, cursor: "pointer", border: "none", background: r === 6 ? C.accent : r === 4 ? "#dd6b2022" : C.card, color: r === 6 ? C.bg : r === 4 ? "#dd6b20" : C.text, boxShadow: r === 6 ? `0 0 20px ${C.accent}44` : "none", transition: "all .1s" }}>
              {r}
            </button>
          ))}
          <button onClick={() => { }} style={{ aspectRatio: "1.2", borderRadius: 14, fontSize: 18, cursor: "pointer", border: `1px solid ${C.border}`, background: C.surface, color: C.muted }}>···</button>
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 20px" }}>
        <button onClick={onUndo || undefined} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${onUndo ? C.red + "66" : C.border}`, background: onUndo ? C.redLo : C.card, color: onUndo ? C.red : C.muted, fontSize: 13, fontWeight: 700, cursor: onUndo ? "pointer" : "not-allowed" }}>↩ Undo</button>
        <button onClick={onPartner} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🤝 Partner</button>
        <button onClick={onExtras} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Extras</button>
        <button onClick={onNewMatch} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New</button>
      </div>
    </div>
  );
}

// ── Wicket Modal ──────────────────────────────────────────────────────────
function WicketModal({ cur, form, setForm, onConfirm, onClose }) {
  return (
    <Sheet title="🏏 Fall of Wicket" onClose={onClose}>
      <GoldLabel>Dismissal type</GoldLabel>
      <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 15, outline: "none", marginBottom: 10, cursor: "pointer" }}>
        {["Bowled", "Caught", "LBW", "Run Out", "Stumped", "Hit Wicket", "Obstructing", "Retired Hurt", "Handled Ball", "Timed Out"].map(w => <option key={w} value={w}>{w}</option>)}
      </select>
      {["Caught", "Run Out", "Stumped"].includes(form.type) && <>
        <GoldLabel>Fielder</GoldLabel>
        <DarkInput placeholder="Fielder name" value={form.fielder || ""} onChange={v => setForm(f => ({ ...f, fielder: v }))} />
      </>}
      <GoldLabel>New Batsman</GoldLabel>
      <DarkInput placeholder="Incoming player name" value={form.newBat || ""} onChange={v => setForm(f => ({ ...f, newBat: v }))} />
      <div style={{ marginTop: 8 }}><GoldBtn onClick={onConfirm}>CONFIRM WICKET</GoldBtn></div>
    </Sheet>
  );
}

// ── Choose Bowler ─────────────────────────────────────────────────────────
function BowlerScr({ name, setName, onDone, onBack }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 400 }} className="fadeIn">
      <TopBar left={<BackBtn onClick={onBack} />} center={<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>CHOOSE BOWLER</span>} />
      <div style={{ padding: "0 16px" }}>
        <GoldLabel>Select new bowler</GoldLabel>
        <DarkInput placeholder="Bowler name" value={name} onChange={setName} />
        <div style={{ marginTop: 16 }}><GoldBtn onClick={onDone} disabled={!name.trim()}>CONFIRM BOWLER →</GoldBtn></div>
      </div>
    </div>
  );
}

// ── Partnerships Modal ────────────────────────────────────────────────────
function PartnershipsModal({ cur, onClose }) {
  const active = cur.curPartnership;
  return (
    <Sheet title="Partnerships" onClose={onClose}>
      <Surface style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Current</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{cur.batsmen[cur.striker]?.name} &amp; {cur.batsmen[cur.nonStriker]?.name}</span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, color: C.accent }}>{active?.runs || 0} <span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>({active?.balls || 0}b)</span></span>
        </div>
      </Surface>
      {cur.partnerships.length === 0
        ? <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "20px 0" }}>No completed partnerships yet</div>
        : <>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>History</div>
          {[...cur.partnerships].reverse().map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.bat1} &amp; {p.bat2}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.reason}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: C.accent }}>{p.runs}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{p.balls}b</div>
              </div>
            </div>
          ))}
        </>
      }
    </Sheet>
  );
}

// ── Extras Modal ──────────────────────────────────────────────────────────
function ExtrasModal({ cur, onClose }) {
  const ext = cur.extras || {};
  const total = (ext.wide || 0) + (ext.noBall || 0) + (ext.bye || 0) + (ext.legBye || 0);
  return (
    <Sheet title="Extras Breakdown" onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, padding: "12px 16px", background: C.accentLo, borderRadius: 12, border: `1px solid ${C.accent}33` }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: C.accent }}>TOTAL EXTRAS</span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 800, color: C.accent }}>{total}</span>
      </div>
      {[{ label: "Byes", key: "bye", type: "bye" }, { label: "Leg Byes", key: "legBye", type: "lb" }, { label: "Wides", key: "wide", type: "wide" }, { label: "No Balls", key: "noBall", type: "nb" }].map(r => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
          <Pill b={{ display: r.label.slice(0, 2), type: r.type }} />
          <span style={{ flex: 1, fontSize: 15, marginLeft: 14 }}>{r.label}</span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: (ext[r.key] || 0) > 0 ? C.text : C.dim }}>{ext[r.key] || 0}</span>
        </div>
      ))}
    </Sheet>
  );
}

// ── Retire Modal ──────────────────────────────────────────────────────────
function RetireModal({ cur, form, setForm, onConfirm, onClose }) {
  return (
    <Sheet title="Retire Batsman" onClose={onClose}>
      <GoldLabel>Who is retiring?</GoldLabel>
      <RadioPill options={[{ val: cur.striker, label: `${cur.batsmen[cur.striker]?.name || ""}*` }, { val: cur.nonStriker, label: cur.batsmen[cur.nonStriker]?.name || "" }]} value={form.batIdx} onChange={v => setForm(f => ({ ...f, batIdx: Number(v) }))} />
      <GoldLabel>Replacement Batsman</GoldLabel>
      <DarkInput placeholder="New player name" value={form.newBat} onChange={v => setForm(f => ({ ...f, newBat: v }))} />
      <div style={{ background: `${C.accent}11`, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.muted, marginBottom: 16 }}>⚠ Retired batsman may return later if wickets allow.</div>
      <GoldBtn disabled={!form.newBat.trim()} onClick={onConfirm}>CONFIRM RETIREMENT</GoldBtn>
    </Sheet>
  );
}

// ── Scoreboard ────────────────────────────────────────────────────────────
function ScoreboardScr({ inn, stab, setStab, ixp, setIxp, result, onBack, onAnalysis, i1n, i2n, onNewMatch }) {
  return (
    <div className="fadeIn">
      <TopBar left={<BackBtn onClick={onBack} />} center={<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>{i1n} <span style={{ color: C.dim }}>vs</span> {i2n}</span>} right={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onAnalysis} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 16 }}>〜</button>
          <button onClick={onNewMatch} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "0 10px" }}>+ New</button>
        </div>
      } />
      <TabRow tabs={[{ val: "scoreboard", label: "Scoreboard" }, { val: "overs", label: "Overs" }]} active={stab} onSelect={setStab} />
      <div style={{ padding: "0 16px 40px" }}>
        {stab === "scoreboard" && <>
          {result && <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: C.accent, padding: "4px 0 12px" }}>{result}</div>}
          {inn.filter(Boolean).map((i, idx) => <InningsBlock key={idx} inn={i} expanded={ixp[idx]} onToggle={() => setIxp(p => { const a = [...p]; a[idx] = !a[idx]; return a; })} />)}
        </>}
        {stab === "overs" && inn.filter(Boolean).map((i, idx) => <OversBlock key={idx} inn={i} />)}
      </div>
    </div>
  );
}

function InningsBlock({ inn, expanded, onToggle }) {
  const ext = inn.extras || {};
  const totalExt = (ext.wide || 0) + (ext.noBall || 0) + (ext.bye || 0) + (ext.legBye || 0);
  return (
    <div style={{ marginBottom: 10 }}>
      <div onClick={onToggle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, border: `1px solid ${C.border}`, padding: "12px 14px", borderRadius: expanded ? "12px 12px 0 0" : 12, cursor: "pointer" }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: 0.5 }}>{inn.battingTeam}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700 }}>{inn.runs}<span style={{ color: C.dim }}>/{inn.wickets}</span> <span style={{ fontSize: 13, color: C.muted }}>({bToO(inn.balls)})</span></span>
          <span style={{ color: C.muted, fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
        {/* Batting */}
        <div style={{ padding: "10px 14px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 32px 32px 28px 28px 46px", gap: "0 6px", fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
            <span>Batsman</span><span style={{ textAlign: "center" }}>R</span><span style={{ textAlign: "center" }}>B</span><span style={{ textAlign: "center" }}>4s</span><span style={{ textAlign: "center" }}>6s</span><span style={{ textAlign: "right" }}>SR</span>
          </div>
          {inn.batsmen.map((b, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 32px 32px 28px 28px 46px", gap: "0 6px", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <div><div style={{ fontWeight: 600 }}>{b.name}</div><div style={{ fontSize: 11, color: C.muted }}>{b.dismissed ? b.dismissal : b.retired ? "retired" : "not out"}</div></div>
              <div style={{ textAlign: "center", fontWeight: 700, color: C.accent }}>{b.runs}</div>
              <div style={{ textAlign: "center", color: C.muted }}>{b.balls}</div>
              <div style={{ textAlign: "center" }}>{b.fours}</div>
              <div style={{ textAlign: "center" }}>{b.sixes}</div>
              <div style={{ textAlign: "right", color: C.muted }}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"}</div>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <span style={{ color: C.muted }}>Extras ({ext.bye || 0}B {ext.legBye || 0}LB {ext.wide || 0}Wd {ext.noBall || 0}NB)</span>
            <span style={{ fontWeight: 700 }}>{totalExt}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "8px 0 10px", fontSize: 13, fontWeight: 700 }}>
            <span>Total</span>
            <span style={{ color: C.accent }}>{inn.runs}/{inn.wickets} ({bToO(inn.balls)}) — {calcRR(inn.runs, inn.balls)}</span>
          </div>
        </div>
        {/* Bowling */}
        {inn.bowlers.length > 0 && <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 36px 28px 32px 28px 46px", gap: "0 6px", fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
            <span>Bowler</span><span style={{ textAlign: "center" }}>O</span><span style={{ textAlign: "center" }}>M</span><span style={{ textAlign: "center" }}>R</span><span style={{ textAlign: "center" }}>W</span><span style={{ textAlign: "right" }}>ER</span>
          </div>
          {inn.bowlers.map((b, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 36px 28px 32px 28px 46px", gap: "0 6px", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span style={{ color: C.blue }}>{b.name}</span>
              <span style={{ textAlign: "center" }}>{Math.floor(b.legalBalls / 6)}.{b.legalBalls % 6}</span>
              <span style={{ textAlign: "center", color: C.muted }}>{b.maidens}</span>
              <span style={{ textAlign: "center" }}>{b.runs}</span>
              <span style={{ textAlign: "center", color: b.wickets > 0 ? C.accent : C.text, fontWeight: b.wickets > 0 ? 700 : 400 }}>{b.wickets}</span>
              <span style={{ textAlign: "right", color: C.muted }}>{b.legalBalls > 0 ? (b.runs / (b.legalBalls / 6)).toFixed(2) : "-"}</span>
            </div>
          ))}
        </div>}
        {/* Partnerships */}
        {inn.partnerships?.length > 0 && <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Partnerships</div>
          {inn.partnerships.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, padding: "3px 0" }}>
              <span>{p.bat1} &amp; {p.bat2}</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{p.runs} ({p.balls}b)</span>
            </div>
          ))}
        </div>}
        {inn.fow.length > 0 && <div style={{ padding: "8px 14px 12px", borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
          <b style={{ color: C.dim }}>FOW: </b>{inn.fow.map(f => `${f.wk}/${f.runs} (${f.bat}, ${f.overs})`).join("  •  ")}
        </div>}
      </div>}
    </div>
  );
}

function OversBlock({ inn }) {
  if (!inn.overHistory?.length) return <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "28px 0" }}>No completed overs yet</div>;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: C.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>{inn.battingTeam}</div>
      {[...inn.overHistory].reverse().map((ov, i) => (
        <Surface key={i} style={{ marginBottom: 8, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span><span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15 }}>OV {ov.overNum}</span> <span style={{ color: C.muted }}>{ov.bowler} → {ov.bat1} &amp; {ov.bat2}</span></span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: C.accent }}>{ov.runs}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {ov.balls.map((b, j) => <Pill key={j} b={b} />)}
          </div>
        </Surface>
      ))}
    </div>
  );
}

// ── Analysis ──────────────────────────────────────────────────────────────
function AnalysisScr({ inn, atab, setAtab, onBack, i1n, i2n }) {
  const maxOv = Math.max(...(inn[0]?.wormData || [{ over: 0 }]).map(d => d.over), ...((inn[1]?.wormData || [{ over: 0 }]).map(d => d.over)));
  const wormData = Array.from({ length: maxOv + 1 }, (_, o) => {
    const d = { over: o };
    const p1 = (inn[0]?.wormData || []).find(x => x.over === o);
    const p2 = (inn[1]?.wormData || []).find(x => x.over === o);
    if (p1) d[i1n] = p1.runs;
    if (p2) d[i2n] = p2.runs;
    return d;
  });
  const rrData = Array.from({ length: maxOv }, (_, o) => {
    const d = { over: o + 1 };
    const getOvR = (wd, ov) => { const c = (wd || []).find(x => x.over === ov); const p = (wd || []).find(x => x.over === ov - 1); return c ? c.runs - (p ? p.runs : 0) : undefined; };
    const r1 = getOvR(inn[0]?.wormData, o + 1), r2 = getOvR(inn[1]?.wormData, o + 1);
    if (r1 !== undefined) d[i1n] = r1;
    if (r2 !== undefined) d[i2n] = r2;
    return d;
  });
  return (
    <div className="fadeIn">
      <TopBar left={<BackBtn onClick={onBack} />} center={<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>ANALYSIS</span>} />
      <TabRow tabs={[{ val: "worm", label: "Worm Chart" }, { val: "runrate", label: "Run Rate" }]} active={atab} onSelect={setAtab} />
      <div style={{ background: C.card, margin: "0 16px", borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px 4px 24px" }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={atab === "worm" ? wormData : rrData} margin={{ top: 10, right: 16, left: -12, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="over" label={{ value: "Overs", position: "insideBottom", offset: -14, fontSize: 12, fill: C.muted }} tick={{ fontSize: 11, fill: C.muted }} />
            <YAxis tick={{ fontSize: 11, fill: C.muted }} label={{ value: "Runs", angle: -90, position: "insideLeft", offset: 14, fontSize: 12, fill: C.muted }} />
            <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text }} />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10, color: C.muted }} />
            {inn[0] && <Line type="monotone" dataKey={i1n} stroke={C.accent} strokeWidth={2.5} dot={{ r: 4, fill: C.accent, stroke: C.bg, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />}
            {inn[1] && <Line type="monotone" dataKey={i2n} stroke={C.blue} strokeWidth={2.5} dot={{ r: 4, fill: C.blue, stroke: C.bg, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}