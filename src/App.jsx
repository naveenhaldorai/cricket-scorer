import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const G = "#2a7a3b";
const GD = "#1b5e20";
const GL = "#e8f5e9";

const bToO = b => `${Math.floor(b / 6)}.${b % 6}`;
const calcRR = (runs, balls) => balls === 0 ? "0.00" : (runs / (balls / 6)).toFixed(2);
const dc = o => JSON.parse(JSON.stringify(o));
const mkBat = n => ({ name: n, runs: 0, balls: 0, fours: 0, sixes: 0, dismissed: false, dismissal: "", bowler: "", retired: false });
const mkBwl = n => ({ name: n, legalBalls: 0, maidens: 0, runs: 0, wickets: 0 });
const blankInn = (bat, bowl) => ({
  battingTeam: bat, bowlingTeam: bowl, runs: 0, wickets: 0, balls: 0,
  batsmen: [], bowlers: [], bowlerIdx: 0, striker: 0, nonStriker: 1,
  overHistory: [], curOverBalls: [], curOverBowlerRuns: 0,
  extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 },
  fow: [],
  partnerships: [],                    // completed partnerships
  curPartnership: { runs: 0, balls: 0, bat1Idx: 0, bat2Idx: 1 },
  wormData: [{ over: 0, runs: 0 }], target: null,
});

export default function App() {
  const [scr, setScr] = useState("setup");
  const [cfg, setCfg] = useState({
    host: "", visitor: "", overs: "20", ppt: "11",
    nb: { on: true, reball: true, run: 1 },
    wb: { on: true, reball: true, run: 1 },
  });
  const [inn, setInn] = useState([null, null]);
  const [ci, setCi] = useState(0);
  const [prevInn, setPrevInn] = useState(null); // for undo — stores last state
  const [open, setOpen] = useState({ striker: "", nonStriker: "", bowler: "" });
  const [mods, setMods] = useState({ wide: false, noBall: false, byes: false, legByes: false, wicket: false });

  // Modals
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
  const [toss, setToss] = useState({ flipping: false, flipped: false, result: "", call: "", winner: "host", elected: "bat" });

  const hn = () => cfg.host || "Host Team";
  const vn = () => cfg.visitor || "Visitor Team";
  const getBatFirst = () => {
    const w = toss.winner === "host" ? hn() : vn();
    return toss.elected === "bat" ? w : (w === hn() ? vn() : hn());
  };

  const flipCoin = () => {
    if (!toss.call || toss.flipping || toss.flipped) return;
    setToss(t => ({ ...t, flipping: true }));
    setTimeout(() => {
      const result = Math.random() < 0.5 ? "heads" : "tails";
      const callWon = result === toss.call;
      const winner = callWon ? toss.winner : (toss.winner === "host" ? "visitor" : "host");
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

  // ── Undo ──────────────────────────────────────────────────────────────
  const handleUndo = () => {
    if (!prevInn) return;
    setInn(prevInn);
    setPrevInn(null);
    resetMods();
  };

  // ── Retire ────────────────────────────────────────────────────────────
  const openRetire = () => {
    const cur = inn[ci];
    if (!cur) return;
    setRetireForm({ batIdx: cur.striker, newBat: "" });
    setShowRetire(true);
  };

  const confirmRetire = () => {
    if (!retireForm.newBat.trim()) return;
    setInn(prev => {
      const arr = [prev[0] ? dc(prev[0]) : null, prev[1] ? dc(prev[1]) : null];
      const i = arr[ci];
      const old = i.batsmen[retireForm.batIdx];
      i.batsmen[retireForm.batIdx] = { ...old, retired: true, dismissal: "retired" };
      // Close current partnership
      i.partnerships = [...i.partnerships, {
        runs: i.curPartnership.runs, balls: i.curPartnership.balls,
        bat1: i.batsmen[i.curPartnership.bat1Idx]?.name || "",
        bat2: i.batsmen[i.curPartnership.bat2Idx]?.name || "",
        reason: `${old.name} retired`,
      }];
      i.batsmen[retireForm.batIdx] = mkBat(retireForm.newBat.trim());
      i.curPartnership = { runs: 0, balls: 0, bat1Idx: i.striker, bat2Idx: i.nonStriker };
      return arr;
    });
    setShowRetire(false);
  };

  // ── Apply Ball ────────────────────────────────────────────────────────
  const handleRunBtn = (run) => {
    const cur = inn[ci];
    if (!cur) return;
    if (mods.wicket) {
      setPendRun(run);
      setWkForm({ type: "Bowled", fielder: "", newBat: "", dismissed: cur.striker });
      setShowWk(true);
      return;
    }
    applyBall(run, null, { ...mods });
  };

  const applyBall = (run, wkData, cm) => {
    // Save snapshot for undo BEFORE applying
    setPrevInn([inn[0] ? dc(inn[0]) : null, inn[1] ? dc(inn[1]) : null]);

    const curMods = cm || { ...mods };
    const newInn = [inn[0] ? dc(inn[0]) : null, inn[1] ? dc(inn[1]) : null];
    const i = newInn[ci];
    if (!i) return;

    const bowler = i.bowlers[i.bowlerIdx];
    const isWide = curMods.wide && cfg.wb.on;
    const isNB = curMods.noBall && cfg.nb.on;
    const isBye = curMods.byes;
    const isLB = curMods.legByes;
    const isWkt = !!wkData;
    const isLegal = !isWide && !(isNB && cfg.nb.reball);
    const wideExtra = isWide ? (cfg.wb.run || 1) : 0;
    const nbExtra = isNB ? (cfg.nb.run || 1) : 0;
    const totalRuns = run + wideExtra + nbExtra;

    i.runs += totalRuns;
    if (!isWide && !isBye && !isLB) {
      i.batsmen[i.striker].runs += run;
      if (run === 4) i.batsmen[i.striker].fours++;
      if (run === 6) i.batsmen[i.striker].sixes++;
    }
    if (isWide) i.extras.wide += wideExtra + run;
    if (isNB) i.extras.noBall += nbExtra;
    if (isBye) i.extras.bye += run;
    if (isLB) i.extras.legBye += run;

    if (isLegal) {
      i.balls++;
      i.batsmen[i.striker].balls++;
      if (bowler) bowler.legalBalls++;
      i.curPartnership.balls++;
    }
    i.curPartnership.runs += run;
    if (bowler) { bowler.runs += totalRuns; i.curOverBowlerRuns += totalRuns; }

    // Ball pill
    let display = String(run), ballType = "normal";
    if (isWide) { display = run > 0 ? `Wd+${run}` : "Wd"; ballType = "wide"; }
    else if (isNB) { display = run > 0 ? `NB+${run}` : "NB"; ballType = "nb"; }
    else if (isBye && run > 0) { display = `B${run}`; ballType = "bye"; }
    else if (isLB && run > 0) { display = `LB${run}`; ballType = "lb"; }
    else if (run === 4) ballType = "four";
    else if (run === 6) ballType = "six";
    if (isWkt) { display = "OUT"; ballType = "wicket"; }
    i.curOverBalls = [...i.curOverBalls, { display, run: totalRuns, rawRun: run, type: ballType }];

    if (!isWkt && !isWide && run % 2 === 1) { const t = i.striker; i.striker = i.nonStriker; i.nonStriker = t; }

    // Wicket
    if (isWkt && wkData) {
      const { type: wt, fielder, newBat, dismissed } = wkData;
      const bn = bowler?.name || "";
      const dis = wt === "Bowled" ? `b ${bn}` : wt === "Caught" ? `c ${fielder} b ${bn}` :
        wt === "LBW" ? `lbw b ${bn}` : wt === "Run Out" ? `run out (${fielder})` :
        wt === "Stumped" ? `st ${fielder} b ${bn}` : wt;
      const old = i.batsmen[dismissed];
      i.batsmen[dismissed] = { ...old, dismissed: true, dismissal: dis, bowler: bn };
      i.wickets++;
      if (bowler && ["Bowled", "Caught", "LBW", "Stumped"].includes(wt)) bowler.wickets++;
      i.fow = [...i.fow, { wk: i.wickets, runs: i.runs, overs: bToO(i.balls), bat: old.name }];
      // Close partnership
      i.partnerships = [...i.partnerships, {
        runs: i.curPartnership.runs, balls: i.curPartnership.balls,
        bat1: i.batsmen[i.curPartnership.bat1Idx]?.name || "",
        bat2: i.batsmen[i.curPartnership.bat2Idx]?.name || "",
        reason: `${old.name} out`,
      }];
      if (newBat) {
        i.batsmen[dismissed] = mkBat(newBat);
        i.curPartnership = { runs: 0, balls: 0, bat1Idx: i.striker, bat2Idx: i.nonStriker };
      }
    }

    // Over complete
    const overComplete = isLegal && i.balls > 0 && i.balls % 6 === 0;
    if (overComplete) {
      if (bowler && i.curOverBowlerRuns === 0) bowler.maidens++;
      const ovNum = Math.floor(i.balls / 6);
      i.overHistory = [...i.overHistory, {
        overNum: ovNum, bowler: bowler?.name || "",
        bat1: i.batsmen[i.striker]?.name || "", bat2: i.batsmen[i.nonStriker]?.name || "",
        balls: [...i.curOverBalls], runs: i.curOverBalls.reduce((s, b) => s + b.run, 0),
      }];
      i.wormData = [...i.wormData, { over: ovNum, runs: i.runs }];
      i.curOverBalls = []; i.curOverBowlerRuns = 0;
      const t = i.striker; i.striker = i.nonStriker; i.nonStriker = t;
    }

    newInn[ci] = i;
    const totalBalls = parseInt(cfg.overs) * 6;
    const inningsOver = i.balls >= totalBalls || i.wickets >= 10;
    resetMods();

    if (inningsOver) {
      if (ci === 0) {
        const i2 = blankInn(i.bowlingTeam, i.battingTeam);
        i2.target = i.runs + 1;
        newInn[1] = i2;
        setInn(newInn); setCi(1); setPrevInn(null);
        setOpen({ striker: "", nonStriker: "", bowler: "" });
        setScr("opening");
      } else {
        setInn(newInn); setPrevInn(null);
        setScr("scoreboard"); setStab("scoreboard"); setIxp([true, true]);
      }
    } else {
      setInn(newInn);
      if (overComplete) setTimeout(() => setShowBwl(true), 50);
    }
  };

  const confirmWicket = () => {
    applyBall(pendRun, { ...wkForm }, { ...mods, wicket: false });
    setShowWk(false);
  };

  const confirmBowler = () => {
    if (!bwlName.trim()) return;
    setInn(prev => {
      const arr = [prev[0] ? dc(prev[0]) : null, prev[1] ? dc(prev[1]) : null];
      const i = arr[ci];
      const ex = i.bowlers.findIndex(b => b.name === bwlName.trim());
      if (ex >= 0) i.bowlerIdx = ex;
      else { i.bowlers = [...i.bowlers, mkBwl(bwlName.trim())]; i.bowlerIdx = i.bowlers.length - 1; }
      return arr;
    });
    setBwlName(""); setShowBwl(false);
  };

  const swapBatsmen = () => {
    setInn(prev => {
      const arr = [prev[0] ? dc(prev[0]) : null, prev[1] ? dc(prev[1]) : null];
      const i = arr[ci]; const t = i.striker; i.striker = i.nonStriker; i.nonStriker = t;
      return arr;
    });
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
    <div style={{ fontFamily: "Roboto,sans-serif", background: "#f0f0f0", minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 60 }}>
      {scr === "setup" && <SetupScr cfg={cfg} setCfg={setCfg} onSettings={() => setScr("settings")} onNext={() => setScr("toss")} />}
      {scr === "settings" && <SettingsScr cfg={cfg} setCfg={setCfg} onBack={() => setScr("setup")} />}
      {scr === "toss" && <TossScr toss={toss} setToss={setToss} onFlip={flipCoin} onContinue={() => setScr("opening")} hn={hn()} vn={vn()} />}
      {scr === "opening" && <OpeningScr open={open} setOpen={setOpen} onStart={ci === 0 ? startMatch : startInn2} ci={ci} batTeam={ci === 0 ? getBatFirst() : (inn[1]?.battingTeam || "")} onBack={() => setScr(ci === 0 ? "toss" : "scoring")} />}
      {scr === "scoring" && cur && (
        <ScoringScr cfg={cfg} inn={inn} ci={ci} cur={cur} mods={mods} setMods={setMods}
          onRun={handleRunBtn} onSwap={swapBatsmen}
          onUndo={prevInn ? handleUndo : null}
          onPartner={() => setShowPartner(true)}
          onExtras={() => setShowExtras(true)}
          onRetire={openRetire}
          onScoreboard={() => { setScr("scoreboard"); setStab("scoreboard"); }}
          onAnalysis={() => setScr("analysis")} />
      )}
      {scr === "scoreboard" && <ScoreboardScr inn={inn} stab={stab} setStab={setStab} ixp={ixp} setIxp={setIxp} result={getResult()} onBack={() => setScr("scoring")} onAnalysis={() => setScr("analysis")} i1n={i1n} i2n={i2n} />}
      {scr === "analysis" && <AnalysisScr inn={inn} atab={atab} setAtab={setAtab} onBack={() => setScr("scoreboard")} i1n={i1n} i2n={i2n} />}

      {showWk && cur && <WicketModal cur={cur} form={wkForm} setForm={setWkForm} onConfirm={confirmWicket} onClose={() => setShowWk(false)} />}
      {showBwl && <BowlerScr name={bwlName} setName={setBwlName} onDone={confirmBowler} onBack={() => setShowBwl(false)} />}
      {showPartner && cur && <PartnershipsModal cur={cur} onClose={() => setShowPartner(false)} />}
      {showExtras && cur && <ExtrasModal cur={cur} onClose={() => setShowExtras(false)} />}
      {showRetire && cur && <RetireModal cur={cur} form={retireForm} setForm={setRetireForm} onConfirm={confirmRetire} onClose={() => setShowRetire(false)} />}

      <style>{`* { box-sizing: border-box; } input,select { font-family: Roboto,sans-serif; } button:active { opacity: 0.75; }
        @keyframes coinSpin { 0%{transform:rotateY(0deg) scale(1)} 25%{transform:rotateY(270deg) scale(1.2)} 60%{transform:rotateY(630deg) scale(1.05)} 100%{transform:rotateY(900deg) scale(1)} }
        .spinning { animation: coinSpin 1.8s ease-in-out forwards; }
        .sheet { background:#f0f0f0; border-radius:14px 14px 0 0; max-height:82vh; overflow-y:auto; }`}
      </style>
    </div>
  );
}

// ── UI Primitives ────────────────────────────────────────────────────────
const AppBar = ({ title, left, right }) => (
  <div style={{ background: G, color: "#fff", padding: "0 14px", height: 54, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
    {left && <div style={{ flexShrink: 0 }}>{left}</div>}
    <div style={{ flex: 1, fontSize: 18, fontWeight: "600" }}>{title}</div>
    {right && <div style={{ flexShrink: 0 }}>{right}</div>}
  </div>
);
const Back = ({ onClick }) => (
  <button onClick={onClick} style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>←</button>
);
const Card = ({ children, style }) => (
  <div style={{ background: "#fff", borderRadius: 6, padding: "12px 14px", marginBottom: 12, ...style }}>{children}</div>
);
const SLabel = ({ children, style }) => (
  <div style={{ color: G, fontWeight: "600", fontSize: 14, marginBottom: 6, marginTop: 10, ...style }}>{children}</div>
);
const UInput = ({ placeholder, value, onChange, type = "text" }) => (
  <div style={{ borderBottom: "1.5px solid #ccc", paddingBottom: 4, marginBottom: 14 }}>
    <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      style={{ border: "none", outline: "none", width: "100%", fontSize: 15, background: "transparent", padding: "4px 0", color: "#222" }} />
  </div>
);
const RadioRow = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: 28 }}>
    {options.map(o => (
      <label key={o.val} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 15, userSelect: "none" }}>
        <div onClick={() => onChange(o.val)} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${G}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {value === o.val && <div style={{ width: 11, height: 11, borderRadius: "50%", background: G }} />}
        </div>
        {o.label}
      </label>
    ))}
  </div>
);
const Toggle = ({ on, onChange }) => (
  <div onClick={() => onChange(!on)} style={{ width: 46, height: 26, borderRadius: 13, background: on ? G : "#bbb", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
    <div style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px #0004" }} />
  </div>
);
const Checkbox = ({ label, checked, onChange }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
    <div onClick={onChange} style={{ width: 18, height: 18, border: `2px solid ${checked ? G : "#bbb"}`, borderRadius: 3, background: checked ? G : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
      {checked && <span style={{ color: "#fff", fontSize: 11, lineHeight: 1, fontWeight: "700" }}>✓</span>}
    </div>
    <span style={{ color: checked ? G : "#444", fontWeight: checked ? "600" : "400" }}>{label}</span>
  </label>
);
const PrimaryBtn = ({ children, onClick, style, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: 15, background: disabled ? "#aaa" : G, color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "600", cursor: disabled ? "not-allowed" : "pointer", ...style }}>{children}</button>
);
const BallPill = ({ b, size = 34 }) => {
  const cs = { wicket: { bg: "#c62828", c: "#fff" }, six: { bg: G, c: "#fff" }, four: { bg: "#e65100", c: "#fff" }, wide: { bg: "#1565c0", c: "#fff" }, nb: { bg: "#6a1b9a", c: "#fff" }, bye: { bg: "#555", c: "#fff" }, lb: { bg: "#777", c: "#fff" }, normal: { bg: "#fff", c: "#333" } };
  const c = cs[b.type] || cs.normal;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: c.bg, color: c.c, border: "1.5px solid #ddd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "700", flexShrink: 0 }}>{b.display}</div>;
};
const BottomNav = () => (
  <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: G, display: "flex" }}>
    {[{ icon: "🏏", label: "New Match", active: true }, { icon: "👥", label: "Teams" }, { icon: "🕐", label: "History" }].map(it => (
      <div key={it.label} style={{ flex: 1, padding: "7px 0 9px", textAlign: "center", cursor: "pointer", color: it.active ? "#fff" : "rgba(255,255,255,0.55)" }}>
        <div style={{ fontSize: 22 }}>{it.icon}</div>
        <div style={{ fontSize: 11, fontWeight: it.active ? "700" : "400" }}>{it.label}</div>
      </div>
    ))}
  </div>
);
const TabBar = ({ tabs, active, onSelect }) => (
  <div style={{ display: "flex", background: G }}>
    {tabs.map(t => (
      <button key={t.val} onClick={() => onSelect(t.val)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", color: "#fff", fontSize: 14, fontWeight: active === t.val ? "700" : "400", borderBottom: active === t.val ? "2.5px solid #fff" : "2.5px solid transparent", cursor: "pointer", opacity: active === t.val ? 1 : 0.65 }}>{t.label}</button>
    ))}
  </div>
);
const BottomSheet = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", flexDirection: "column" }}>
    <div style={{ flex: 1 }} onClick={onClose} />
    <div className="sheet">
      <AppBar title={title} left={<Back onClick={onClose} />} />
      <div style={{ padding: "16px 14px" }}>{children}</div>
    </div>
  </div>
);

// ── Setup ─────────────────────────────────────────────────────────────────
function SetupScr({ cfg, setCfg, onSettings, onNext }) {
  return (
    <div>
      <AppBar title={<><b>Cricket</b> scorer</>} right={<div style={{ display: "flex", gap: 16 }}><span style={{ fontSize: 22 }}>🔔</span><span style={{ fontSize: 22 }}>⚙️</span></div>} />
      <div style={{ padding: "12px 14px" }}>
        <SLabel>Teams</SLabel>
        <Card>
          <UInput placeholder="Host Team" value={cfg.host} onChange={v => setCfg(c => ({ ...c, host: v }))} />
          <UInput placeholder="Visitor Team" value={cfg.visitor} onChange={v => setCfg(c => ({ ...c, visitor: v }))} />
        </Card>
        <SLabel>Toss won by?</SLabel>
        <Card><RadioRow options={[{ val: "host", label: cfg.host || "Host Team" }, { val: "visitor", label: cfg.visitor || "Visitor Team" }]} value={cfg.tossWon || "host"} onChange={v => setCfg(c => ({ ...c, tossWon: v }))} /></Card>
        <SLabel>Opted to?</SLabel>
        <Card><RadioRow options={[{ val: "bat", label: "Bat" }, { val: "bowl", label: "Bowl" }]} value={cfg.elected || "bat"} onChange={v => setCfg(c => ({ ...c, elected: v }))} /></Card>
        <SLabel>Overs?</SLabel>
        <Card><UInput placeholder="20" value={cfg.overs} type="number" onChange={v => setCfg(c => ({ ...c, overs: v }))} /></Card>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onSettings} style={{ flex: 1, padding: 14, background: "transparent", border: "none", fontSize: 15, color: "#333", cursor: "pointer", fontWeight: "500" }}>Advanced settings</button>
          <button onClick={onNext} style={{ flex: 1.4, padding: 14, background: G, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: "600", cursor: "pointer" }}>Start match</button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────
function SettingsScr({ cfg, setCfg, onBack }) {
  return (
    <div>
      <AppBar title="Match Settings" left={<Back onClick={onBack} />} />
      <div style={{ padding: "12px 14px" }}>
        <SLabel>Players per team?</SLabel>
        <Card><UInput placeholder="11" value={cfg.ppt} type="number" onChange={v => setCfg(c => ({ ...c, ppt: v }))} /></Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 6 }}>
          <span style={{ color: G, fontWeight: "600", fontSize: 14 }}>No Ball</span>
          <Toggle on={cfg.nb.on} onChange={v => setCfg(c => ({ ...c, nb: { ...c.nb, on: v } }))} />
        </div>
        {cfg.nb.on && <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><span>Re-ball</span><Toggle on={cfg.nb.reball} onChange={v => setCfg(c => ({ ...c, nb: { ...c.nb, reball: v } }))} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>No ball run</span><input type="number" value={cfg.nb.run} onChange={e => setCfg(c => ({ ...c, nb: { ...c.nb, run: parseInt(e.target.value) || 1 } }))} style={{ width: 50, border: "none", borderBottom: "1.5px solid #ccc", textAlign: "right", fontSize: 15, outline: "none", background: "transparent" }} /></div>
        </Card>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 6 }}>
          <span style={{ color: G, fontWeight: "600", fontSize: 14 }}>Wide Ball</span>
          <Toggle on={cfg.wb.on} onChange={v => setCfg(c => ({ ...c, wb: { ...c.wb, on: v } }))} />
        </div>
        {cfg.wb.on && <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><span>Re-ball</span><Toggle on={cfg.wb.reball} onChange={v => setCfg(c => ({ ...c, wb: { ...c.wb, reball: v } }))} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Wide ball run</span><input type="number" value={cfg.wb.run} onChange={e => setCfg(c => ({ ...c, wb: { ...c.wb, run: parseInt(e.target.value) || 1 } }))} style={{ width: 50, border: "none", borderBottom: "1.5px solid #ccc", textAlign: "right", fontSize: 15, outline: "none", background: "transparent" }} /></div>
        </Card>}
        <PrimaryBtn style={{ marginTop: 24 }} onClick={onBack}>Save settings</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Toss ──────────────────────────────────────────────────────────────────
function TossScr({ toss, setToss, onFlip, onContinue, hn, vn }) {
  const winnerName = toss.flipped ? (toss.winner === "host" ? hn : vn) : "";
  return (
    <div>
      <AppBar title="Coin Toss" left={<Back onClick={() => { }} />} />
      <div style={{ padding: "16px 14px" }}>
        <SLabel>Who called the toss?</SLabel>
        <Card><RadioRow options={[{ val: "host", label: hn }, { val: "visitor", label: vn }]} value={toss.winner} onChange={v => setToss(t => ({ ...t, winner: v }))} /></Card>
        <SLabel>Called?</SLabel>
        <Card><RadioRow options={[{ val: "heads", label: "Heads 👑" }, { val: "tails", label: "Tails 🏏" }]} value={toss.call} onChange={v => setToss(t => ({ ...t, call: v }))} /></Card>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "28px 0 20px" }}>
          <div className={toss.flipping ? "spinning" : ""} style={{ width: 130, height: 130, borderRadius: "50%", background: !toss.flipped ? "conic-gradient(#ffd700,#b8860b,#ffd700)" : toss.result === "heads" ? "radial-gradient(circle at 35% 35%, #ffe066, #b8860b)" : "radial-gradient(circle at 35% 35%, #e0e0e0, #888)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, boxShadow: "0 8px 28px #0004", border: "5px solid rgba(255,255,255,0.4)" }}>
            {toss.flipping ? "🪙" : toss.flipped ? (toss.result === "heads" ? "👑" : "🏏") : "🪙"}
          </div>
          {toss.flipped && <div style={{ marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: "700", color: G }}>{toss.result === "heads" ? "Heads!" : "Tails!"}</div>
            <div style={{ fontSize: 16, color: "#444", marginTop: 4 }}>🎉 <b>{winnerName}</b> won the toss!</div>
          </div>}
        </div>
        {!toss.flipped
          ? <PrimaryBtn onClick={onFlip} style={{ opacity: toss.call ? 1 : 0.45 }}>Flip Coin! 🪙</PrimaryBtn>
          : <>
            <SLabel>Elected to?</SLabel>
            <Card><RadioRow options={[{ val: "bat", label: "Bat" }, { val: "bowl", label: "Bowl" }]} value={toss.elected} onChange={v => setToss(t => ({ ...t, elected: v }))} /></Card>
            <div style={{ background: GL, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 14, color: GD }}>🏏 <b>{winnerName}</b> elected to <b>{toss.elected}</b> first.</div>
            <PrimaryBtn onClick={onContinue}>Continue →</PrimaryBtn>
          </>
        }
      </div>
    </div>
  );
}

// ── Opening Players ───────────────────────────────────────────────────────
function OpeningScr({ open, setOpen, onStart, ci, batTeam, onBack }) {
  return (
    <div>
      <AppBar title="Select Opening players" left={<Back onClick={onBack} />} />
      <div style={{ padding: "16px 14px" }}>
        {batTeam && <div style={{ background: GL, borderRadius: 6, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: GD }}>🏏 {batTeam} is batting {ci === 1 ? "(2nd innings)" : ""}</div>}
        <SLabel>Striker</SLabel>
        <UInput placeholder="Player name" value={open.striker} onChange={v => setOpen(o => ({ ...o, striker: v }))} />
        <SLabel>Non-striker</SLabel>
        <UInput placeholder="Player name" value={open.nonStriker} onChange={v => setOpen(o => ({ ...o, nonStriker: v }))} />
        <SLabel>Opening bowler</SLabel>
        <UInput placeholder="Player name" value={open.bowler} onChange={v => setOpen(o => ({ ...o, bowler: v }))} />
        <PrimaryBtn style={{ marginTop: 8 }} onClick={onStart}>Start match</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Scoring Screen ────────────────────────────────────────────────────────
function ScoringScr({ cfg, inn, ci, cur, mods, setMods, onRun, onSwap, onUndo, onPartner, onExtras, onRetire, onScoreboard, onAnalysis }) {
  const bowler = cur.bowlers[cur.bowlerIdx];
  const striker = cur.batsmen[cur.striker];
  const nonStriker = cur.batsmen[cur.nonStriker];
  const totalOvers = parseInt(cfg.overs) || 20;
  const ballsLeft = totalOvers * 6 - cur.balls;
  const i1n = inn[0]?.battingTeam || ""; const i2n = inn[0]?.bowlingTeam || "";

  const toggleMod = k => setMods(m => {
    const n = { ...m, [k]: !m[k] };
    if (k === "wide" && n.wide) n.noBall = false;
    if (k === "noBall" && n.noBall) n.wide = false;
    return n;
  });

  return (
    <div>
      <AppBar title={`${i1n} v/s ${i2n}`} left={<Back onClick={onScoreboard} />} right={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onAnalysis} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>〜</button>
          <div onClick={onScoreboard} style={{ background: "#fff", color: G, borderRadius: 5, padding: "3px 8px", fontSize: 13, fontWeight: "700", cursor: "pointer" }}>{ci + 1}:{Math.floor(cur.balls / 6) + 1}</div>
        </div>
      } />

      {/* Score Block */}
      <Card style={{ margin: "8px 10px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{cur.battingTeam}, {ci + 1}{ci === 0 ? "st" : "nd"} inning</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 44, fontWeight: "700", lineHeight: 1.1 }}>{cur.runs}</span>
              <span style={{ fontSize: 36, fontWeight: "200", color: "#bbb" }}>-</span>
              <span style={{ fontSize: 44, fontWeight: "700", lineHeight: 1.1 }}>{cur.wickets}</span>
              <span style={{ fontSize: 16, color: "#888", marginLeft: 4 }}>({bToO(cur.balls)})</span>
            </div>
            {cur.target && <div style={{ fontSize: 12, color: "#e65100", marginTop: 2 }}>Need {cur.target - cur.runs} off {ballsLeft}b</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>CRR</div>
            <div style={{ fontSize: 20, fontWeight: "600" }}>{calcRR(cur.runs, cur.balls)}</div>
            {cur.target && <div style={{ fontSize: 11, color: "#e65100", marginTop: 2 }}>RRR {calcRR(Math.max(0, cur.target - cur.runs), ballsLeft)}</div>}
          </div>
        </div>
        {/* Current partnership inline */}
        <div style={{ marginTop: 6, padding: "5px 8px", background: GL, borderRadius: 6, fontSize: 12, color: GD, display: "flex", gap: 12 }}>
          <span>🤝 Partnership: <b>{cur.curPartnership?.runs || 0}</b> ({cur.curPartnership?.balls || 0}b)</span>
          <span style={{ color: "#999" }}>|</span>
          <span style={{ cursor: "pointer", color: G, fontWeight: "600" }} onClick={onPartner}>View all →</span>
        </div>
      </Card>

      {/* Mini Scorecard */}
      <Card style={{ margin: "0 10px 6px", padding: "8px 10px" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead><tr style={{ color: "#999" }}>
            <th style={{ textAlign: "left", fontWeight: "400", padding: "2px 0" }}>Batsman</th>
            {["R", "B", "4s", "6s", "SR"].map(h => <th key={h} style={{ textAlign: "center", fontWeight: "400", padding: "2px 4px" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[{ b: striker, star: true }, { b: nonStriker, star: false }].map(({ b, star }, idx) => b && (
              <tr key={idx}><td style={{ color: G, fontWeight: star ? "600" : "400", padding: "3px 0" }}>{b.name}{star ? "*" : ""}</td>
                <td style={{ textAlign: "center" }}>{b.runs}</td><td style={{ textAlign: "center" }}>{b.balls}</td>
                <td style={{ textAlign: "center" }}>{b.fours}</td><td style={{ textAlign: "center" }}>{b.sixes}</td>
                <td style={{ textAlign: "center" }}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ height: 1, background: "#eee", margin: "6px 0" }} />
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead><tr style={{ color: "#999" }}>
            <th style={{ textAlign: "left", fontWeight: "400" }}>Bowler</th>
            {["O", "M", "R", "W", "ER"].map(h => <th key={h} style={{ textAlign: "center", fontWeight: "400", padding: "2px 4px" }}>{h}</th>)}
          </tr></thead>
          <tbody>{bowler && <tr>
            <td style={{ color: G, padding: "3px 0" }}>{bowler.name}</td>
            <td style={{ textAlign: "center" }}>{Math.floor(bowler.legalBalls / 6)}.{bowler.legalBalls % 6}</td>
            <td style={{ textAlign: "center" }}>{bowler.maidens}</td>
            <td style={{ textAlign: "center" }}>{bowler.runs}</td>
            <td style={{ textAlign: "center" }}>{bowler.wickets}</td>
            <td style={{ textAlign: "center" }}>{bowler.legalBalls > 0 ? (bowler.runs / (bowler.legalBalls / 6)).toFixed(2) : "0.00"}</td>
          </tr>}</tbody>
        </table>
      </Card>

      {/* This Over */}
      <Card style={{ margin: "0 10px 6px", padding: "8px 10px", minHeight: 46 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>This over:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {cur.curOverBalls.map((b, i) => <BallPill key={i} b={b} />)}
        </div>
      </Card>

      {/* Modifiers */}
      <Card style={{ margin: "0 10px 6px", padding: "10px 12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 10 }}>
          {[["wide", "Wide"], ["noBall", "No Ball"], ["byes", "Byes"], ["legByes", "Leg Byes"]].map(([k, l]) => (
            <Checkbox key={k} label={l} checked={mods[k]} onChange={() => toggleMod(k)} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Checkbox label="Wicket" checked={mods.wicket} onChange={() => toggleMod("wicket")} />
          <div style={{ flex: 1 }} />
          <button onClick={onRetire} style={{ padding: "7px 10px", background: G, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: "600", cursor: "pointer" }}>Retire</button>
          <button onClick={onSwap} style={{ padding: "7px 10px", background: G, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: "600", cursor: "pointer" }}>Swap Batsman</button>
        </div>
      </Card>

      {/* Actions + Run Buttons */}
      <div style={{ display: "flex", gap: 8, margin: "0 10px", alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 104 }}>
          <button onClick={onUndo || undefined} style={{ padding: "10px 6px", background: onUndo ? "#c62828" : "#aaa", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: "600", cursor: onUndo ? "pointer" : "not-allowed" }}>
            ↩ Undo
          </button>
          <button onClick={onPartner} style={{ padding: "10px 6px", background: G, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: "600", cursor: "pointer" }}>
            🤝 Partner
          </button>
          <button onClick={onExtras} style={{ padding: "10px 6px", background: G, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: "600", cursor: "pointer" }}>
            Extras
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
            {[0, 1, 2, 3, 4, 5, 6, "..."].map(r => (
              <button key={r} onClick={() => typeof r === "number" ? onRun(r) : null}
                style={{ aspectRatio: "1", borderRadius: "50%", fontSize: 18, fontWeight: "700", cursor: "pointer", border: `2px solid ${r === 4 ? "#e65100" : G}`, background: r === 6 ? G : r === 4 ? "#e65100" : "#fff", color: r === 6 || r === 4 ? "#fff" : "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wicket Modal ──────────────────────────────────────────────────────────
function WicketModal({ cur, form, setForm, onConfirm, onClose }) {
  return (
    <BottomSheet title="Fall of wicket" onClose={onClose}>
      <SLabel>How wicket fall?</SLabel>
      <div style={{ borderBottom: "1.5px solid #ccc", marginBottom: 14, position: "relative" }}>
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ border: "none", outline: "none", width: "100%", fontSize: 15, padding: "6px 0", background: "transparent", cursor: "pointer", color: "#222", appearance: "none" }}>
          {["Bowled", "Caught", "LBW", "Run Out", "Stumped", "Hit Wicket", "Obstructing", "Retired Hurt", "Handled Ball", "Timed Out"].map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <span style={{ position: "absolute", right: 4, top: 8, pointerEvents: "none", color: "#888", fontSize: 12 }}>▼</span>
      </div>
      {["Caught", "Run Out", "Stumped"].includes(form.type) && (
        <><SLabel>Fielder</SLabel><UInput placeholder="Fielder name" value={form.fielder || ""} onChange={v => setForm(f => ({ ...f, fielder: v }))} /></>
      )}
      <SLabel>New batsman</SLabel>
      <UInput placeholder="Player name" value={form.newBat || ""} onChange={v => setForm(f => ({ ...f, newBat: v }))} />
      <PrimaryBtn style={{ marginTop: 8 }} onClick={onConfirm}>Done</PrimaryBtn>
    </BottomSheet>
  );
}

// ── Choose Bowler ─────────────────────────────────────────────────────────
function BowlerScr({ name, setName, onDone, onBack }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#f0f0f0", zIndex: 300 }}>
      <AppBar title="Choose bowler" left={<Back onClick={onBack} />} />
      <div style={{ padding: "16px 14px" }}>
        <SLabel>Select a new bowler</SLabel>
        <UInput placeholder="Name" value={name} onChange={setName} />
        <PrimaryBtn style={{ marginTop: 16 }} onClick={onDone}>Done</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Partnerships Modal ────────────────────────────────────────────────────
function PartnershipsModal({ cur, onClose }) {
  const completed = cur.partnerships || [];
  const active = cur.curPartnership;
  const striker = cur.batsmen[cur.striker];
  const nonStriker = cur.batsmen[cur.nonStriker];
  const totalRuns = cur.runs;

  return (
    <BottomSheet title="Partnerships" onClose={onClose}>
      {/* Current */}
      <div style={{ background: GL, borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: GD, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Current</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: "600" }}>{striker?.name} & {nonStriker?.name}</span>
          <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "700", color: G }}>{active?.runs || 0} <span style={{ fontSize: 12, color: "#666", fontWeight: "400" }}>({active?.balls || 0}b)</span></span>
        </div>
      </div>

      {/* History */}
      {completed.length === 0
        ? <div style={{ color: "#aaa", fontSize: 14, textAlign: "center", padding: "16px 0" }}>No completed partnerships yet</div>
        : <>
          <div style={{ fontSize: 12, color: "#888", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>History</div>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ textAlign: "left", padding: "7px 8px", fontWeight: "600", color: "#555" }}>Batsmen</th>
                <th style={{ textAlign: "center", padding: "7px 6px", fontWeight: "600", color: "#555" }}>Runs</th>
                <th style={{ textAlign: "center", padding: "7px 6px", fontWeight: "600", color: "#555" }}>Balls</th>
                <th style={{ textAlign: "center", padding: "7px 6px", fontWeight: "600", color: "#555" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {[...completed].reverse().map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "7px 8px" }}>
                    <div style={{ fontWeight: "500" }}>{p.bat1} & {p.bat2}</div>
                    <div style={{ fontSize: 11, color: "#999" }}>{p.reason}</div>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: "700", color: G }}>{p.runs}</td>
                  <td style={{ textAlign: "center" }}>{p.balls}</td>
                  <td style={{ textAlign: "center", fontSize: 12 }}>{totalRuns > 0 ? ((p.runs / totalRuns) * 100).toFixed(0) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      }
    </BottomSheet>
  );
}

// ── Extras Modal ──────────────────────────────────────────────────────────
function ExtrasModal({ cur, onClose }) {
  const ext = cur.extras || { wide: 0, noBall: 0, bye: 0, legBye: 0 };
  const total = (ext.wide || 0) + (ext.noBall || 0) + (ext.bye || 0) + (ext.legBye || 0);
  const rows = [
    { label: "Byes", key: "bye", icon: "B", color: "#555" },
    { label: "Leg Byes", key: "legBye", icon: "LB", color: "#777" },
    { label: "Wides", key: "wide", icon: "Wd", color: "#1565c0" },
    { label: "No Balls", key: "noBall", icon: "NB", color: "#6a1b9a" },
  ];
  return (
    <BottomSheet title="Extras Breakdown" onClose={onClose}>
      <div style={{ background: GL, borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: "600", color: GD }}>Total Extras</span>
        <span style={{ fontSize: 28, fontWeight: "700", color: G }}>{total}</span>
      </div>
      {rows.map(r => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", padding: "12px 4px", borderBottom: "1px solid #eee" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: r.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "700", marginRight: 14, flexShrink: 0 }}>{r.icon}</div>
          <span style={{ flex: 1, fontSize: 15 }}>{r.label}</span>
          <span style={{ fontSize: 22, fontWeight: "700", color: (ext[r.key] || 0) > 0 ? "#333" : "#ccc" }}>{ext[r.key] || 0}</span>
        </div>
      ))}
      {total === 0 && <div style={{ color: "#aaa", fontSize: 14, textAlign: "center", padding: "16px 0" }}>No extras recorded yet</div>}
    </BottomSheet>
  );
}

// ── Retire Modal ──────────────────────────────────────────────────────────
function RetireModal({ cur, form, setForm, onConfirm, onClose }) {
  const striker = cur.batsmen[cur.striker];
  const nonStriker = cur.batsmen[cur.nonStriker];
  return (
    <BottomSheet title="Retire Batsman" onClose={onClose}>
      <SLabel>Who is retiring?</SLabel>
      <Card style={{ marginBottom: 14 }}>
        <RadioRow
          options={[
            { val: cur.striker, label: `${striker?.name || ""}* (striker)` },
            { val: cur.nonStriker, label: `${nonStriker?.name || ""} (non-striker)` },
          ]}
          value={form.batIdx}
          onChange={v => setForm(f => ({ ...f, batIdx: Number(v) }))}
        />
      </Card>
      <SLabel>Replacement batsman</SLabel>
      <UInput placeholder="New player name" value={form.newBat} onChange={v => setForm(f => ({ ...f, newBat: v }))} />
      <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#795548", marginBottom: 14 }}>
        ⚠️ The retired batsman may return to bat later if wickets allow.
      </div>
      <PrimaryBtn disabled={!form.newBat.trim()} onClick={onConfirm}>Confirm Retirement</PrimaryBtn>
    </BottomSheet>
  );
}

// ── Scoreboard ────────────────────────────────────────────────────────────
function ScoreboardScr({ inn, stab, setStab, ixp, setIxp, result, onBack, onAnalysis, i1n, i2n }) {
  return (
    <div>
      <AppBar title={`${i1n} v/s ${i2n}`} left={<Back onClick={onBack} />} right={
        <div style={{ display: "flex", gap: 14 }}>
          <button onClick={onAnalysis} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>〜</button>
          <button style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}>🔗</button>
        </div>
      } />
      <TabBar tabs={[{ val: "scoreboard", label: "Scoreboard" }, { val: "overs", label: "Overs" }]} active={stab} onSelect={setStab} />
      <div style={{ padding: "8px 10px" }}>
        {stab === "scoreboard" && <>
          {result && <div style={{ padding: "8px 4px 4px", fontSize: 14, fontWeight: "600", color: G }}>{result}</div>}
          {inn.filter(Boolean).map((i, idx) => (
            <InningsBlock key={idx} inn={i} expanded={ixp[idx]} onToggle={() => setIxp(p => { const a = [...p]; a[idx] = !a[idx]; return a; })} />
          ))}
        </>}
        {stab === "overs" && inn.filter(Boolean).map((i, idx) => <OversBlock key={idx} inn={i} />)}
      </div>
    </div>
  );
}

function InningsBlock({ inn, expanded, onToggle }) {
  const ext = inn.extras || { wide: 0, noBall: 0, bye: 0, legBye: 0 };
  const totalExt = (ext.wide || 0) + (ext.noBall || 0) + (ext.bye || 0) + (ext.legBye || 0);
  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={onToggle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: GL, padding: "10px 12px", borderRadius: expanded ? "8px 8px 0 0" : 8, cursor: "pointer" }}>
        <span style={{ fontWeight: "600", fontSize: 15 }}>{inn.battingTeam}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>{inn.runs}-{inn.wickets} ({bToO(inn.balls)})</span>
          <span style={{ fontSize: 11 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && <div style={{ background: "#fff", borderRadius: "0 0 8px 8px", border: "1px solid #ddd", borderTop: "none", overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f8f8f8" }}>
            <th style={{ textAlign: "left", padding: "7px 10px", fontWeight: "600", color: "#555" }}>Batsman</th>
            {["R", "B", "4s", "6s", "SR"].map(h => <th key={h} style={{ textAlign: "center", padding: "7px 5px", fontWeight: "600", color: "#555" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {inn.batsmen.map((b, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "7px 10px" }}><div style={{ fontWeight: "500" }}>{b.name}</div><div style={{ fontSize: 11, color: "#888" }}>{b.dismissed ? b.dismissal : b.retired ? "retired" : "not out"}</div></td>
                <td style={{ textAlign: "center", fontWeight: "600" }}>{b.runs}</td>
                <td style={{ textAlign: "center" }}>{b.balls}</td>
                <td style={{ textAlign: "center" }}>{b.fours}</td>
                <td style={{ textAlign: "center" }}>{b.sixes}</td>
                <td style={{ textAlign: "center" }}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00"}</td>
              </tr>
            ))}
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "7px 10px", fontWeight: "500" }}>Extras</td>
              <td style={{ textAlign: "center", fontWeight: "600" }}>{totalExt}</td>
              <td colSpan={4} style={{ textAlign: "right", fontSize: 11, color: "#666", paddingRight: 10 }}>{ext.bye || 0} B, {ext.legBye || 0} LB, {ext.wide || 0} WD, {ext.noBall || 0} NB</td>
            </tr>
            <tr style={{ background: "#f5f5f5" }}>
              <td style={{ padding: "7px 10px", fontWeight: "700" }}>Total</td>
              <td colSpan={5} style={{ textAlign: "right", paddingRight: 10, fontWeight: "700" }}>{inn.runs}-{inn.wickets} ({bToO(inn.balls)}) &nbsp; {calcRR(inn.runs, inn.balls)}</td>
            </tr>
          </tbody>
        </table>
        {inn.bowlers.length > 0 && <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f8f8f8" }}>
            <th style={{ textAlign: "left", padding: "7px 10px", fontWeight: "600", color: "#555" }}>Bowler</th>
            {["O", "M", "R", "W", "ER"].map(h => <th key={h} style={{ textAlign: "center", padding: "7px 5px", fontWeight: "600", color: "#555" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {inn.bowlers.map((b, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "7px 10px" }}>{b.name}</td>
                <td style={{ textAlign: "center" }}>{Math.floor(b.legalBalls / 6)}.{b.legalBalls % 6}</td>
                <td style={{ textAlign: "center" }}>{b.maidens}</td>
                <td style={{ textAlign: "center" }}>{b.runs}</td>
                <td style={{ textAlign: "center", color: b.wickets > 0 ? G : "inherit", fontWeight: b.wickets > 0 ? "700" : "400" }}>{b.wickets}</td>
                <td style={{ textAlign: "center" }}>{b.legalBalls > 0 ? (b.runs / (b.legalBalls / 6)).toFixed(2) : "0.00"}</td>
              </tr>
            ))}
          </tbody>
        </table>}
        {/* Partnerships summary in scoreboard */}
        {(inn.partnerships?.length > 0 || inn.curPartnership?.runs > 0) && (
          <div style={{ padding: "8px 10px", borderTop: "1px solid #f0f0f0" }}>
            <div style={{ fontSize: 12, fontWeight: "700", color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Partnerships</div>
            {inn.partnerships?.map((p, i) => (
              <div key={i} style={{ fontSize: 12, color: "#555", display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span>{p.bat1} & {p.bat2}</span>
                <span style={{ fontWeight: "600" }}>{p.runs} ({p.balls}b)</span>
              </div>
            ))}
          </div>
        )}
        {inn.fow.length > 0 && <div style={{ padding: "6px 10px 8px", fontSize: 11, color: "#666", borderTop: "1px solid #f0f0f0" }}><b>Fall of wickets: </b>{inn.fow.map(f => `${f.wk}/${f.runs} (${f.bat}, ${f.overs})`).join(", ")}</div>}
      </div>}
    </div>
  );
}

function OversBlock({ inn }) {
  if (!inn.overHistory?.length) return <div style={{ color: "#aaa", fontSize: 14, textAlign: "center", padding: "24px 0" }}>No completed overs yet</div>;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: "700", color: G, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #ddd" }}>{inn.battingTeam}</div>
      {[...inn.overHistory].reverse().map((ov, i) => (
        <div key={i} style={{ borderBottom: "1px solid #e8e8e8", padding: "10px 2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span><b>Ov {ov.overNum}</b> &nbsp; <span style={{ color: "#555" }}>{ov.bowler} to {ov.bat1} & {ov.bat2}</span></span>
            <span style={{ fontWeight: "700", color: G }}>{ov.runs} Runs</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {ov.balls.map((b, j) => <BallPill key={j} b={b} size={36} />)}
          </div>
        </div>
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
    const r1 = getOvR(inn[0]?.wormData, o + 1); const r2 = getOvR(inn[1]?.wormData, o + 1);
    if (r1 !== undefined) d[i1n] = r1;
    if (r2 !== undefined) d[i2n] = r2;
    return d;
  });
  return (
    <div>
      <AppBar title="Analysis" left={<Back onClick={onBack} />} />
      <TabBar tabs={[{ val: "worm", label: "Worm" }, { val: "runrate", label: "Run rate" }]} active={atab} onSelect={setAtab} />
      <div style={{ background: "#fff", padding: "16px 4px 24px", minHeight: "60vh" }}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={atab === "worm" ? wormData : rrData} margin={{ top: 20, right: 20, left: -8, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="over" label={{ value: "Overs", position: "insideBottom", offset: -14, fontSize: 13 }} tick={{ fontSize: 12 }} />
            <YAxis label={{ value: "Runs", angle: -90, position: "insideLeft", offset: 12, fontSize: 13 }} tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
            {inn[0] && <Line type="monotone" dataKey={i1n} stroke="#00acc1" strokeWidth={2.5} dot={{ r: 5, fill: "#00acc1", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7 }} connectNulls />}
            {inn[1] && <Line type="monotone" dataKey={i2n} stroke="#9ccc00" strokeWidth={2.5} dot={{ r: 5, fill: "#9ccc00", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7 }} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}