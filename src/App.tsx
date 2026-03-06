import { useEffect, useMemo, useState } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import {
  CirclePause,
  Copy,
  ExternalLink,
  Layers3,
  Play,
  Sparkles,
  Target,
  Wallet,
  WandSparkles,
} from 'lucide-react';

type Stage = 'asset' | 'distribution' | 'go-live';
type RuntimeStatus = 'idle' | 'syncing' | 'live' | 'invalid';
type NoticeTone = 'ok' | 'warn';

type Notice = {
  text: string;
  tone: NoticeTone;
} | null;

const STORAGE_KEY = 'launch_control_contract_address';
const DEFAULT_CONTRACT = (import.meta.env.VITE_CONTRACT_ADDRESS || '').trim();
const STAGES: Stage[] = ['asset', 'distribution', 'go-live'];

const launchModes = [
  { id: 'fair', label: 'Fair Launch', share: 42, desc: 'Open participation, slower unlock, wider reach.' },
  { id: 'gated', label: 'MOTO-Gated', share: 34, desc: 'MOTO holders get priority windows and reserved allocation.' },
  { id: 'council', label: 'Council Sale', share: 24, desc: 'Small curated tranche for strategic operators.' },
] as const;

const stageNotes: Record<Stage, string> = {
  asset: 'Define launch token, supply frame, and PIL economics before anything else.',
  distribution: 'Shape who gets in, how vesting behaves, and where MOTO unlocks privilege.',
  'go-live': 'Final pass: publish, monitor campaign state, and react if execution drifts.',
};

function isLikelyContract(value: string): boolean {
  return /^opt1[a-z0-9]{10,}$/.test(value) || /^tb1[a-z0-9]{10,}$/i.test(value);
}

function formatMoney(value: number): string {
  return `${value.toFixed(2)} BTC`;
}

function loadContract(): string {
  if (typeof window === 'undefined') return DEFAULT_CONTRACT;
  return window.localStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_CONTRACT;
}

function copyText(value: string, setNotice: (value: Notice) => void) {
  if (!value) {
    setNotice({ tone: 'warn', text: 'No contract configured yet.' });
    return;
  }

  void navigator.clipboard.writeText(value)
    .then(() => setNotice({ tone: 'ok', text: 'Contract copied to clipboard.' }))
    .catch(() => setNotice({ tone: 'warn', text: 'Clipboard write failed.' }));
}

function StageRail({
  stage,
  onStage,
}: {
  stage: Stage;
  onStage: (next: Stage) => void;
}) {
  return (
    <section className="stage-rail" aria-label="Launch stages">
      {STAGES.map((item, index) => (
        <button
          key={item}
          type="button"
          className={item === stage ? 'active' : ''}
          onClick={() => onStage(item)}
        >
          <span className="stage-index">0{index + 1}</span>
          <span className="stage-meta">
            <span className="stage-label">{item.replace('-', ' ')}</span>
            <span className="stage-copy">{stageNotes[item]}</span>
          </span>
        </button>
      ))}
    </section>
  );
}

function RaiseCurve({ commitment }: { commitment: number }) {
  const values = [16, 20, 28, 34, 43, 57, 68, 74, 86];
  const committed = values.map((value, index) => value + commitment * 0.8 + index * 2);
  const peak = Math.max(...committed);
  const floor = Math.min(...committed);
  const span = Math.max(1, peak - floor);
  const line = committed.map((value, index) => {
    const x = (index / (committed.length - 1)) * 100;
    const y = ((peak - value) / span) * 70 + 10;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `${line} L100,90 L0,90 Z`;

  return (
    <article className="panel chart-card">
      <header>
        <p className="eyebrow">Raise Curve</p>
        <h3>Commitment Pressure</h3>
      </header>
      <svg viewBox="0 0 100 90" aria-label="Raise curve">
        <defs>
          <linearGradient id="launch-curve" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 173, 59, 0.42)" />
            <stop offset="100%" stopColor="rgba(255, 173, 59, 0.04)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#launch-curve)" />
        <path d={line} fill="none" stroke="rgba(255, 173, 59, 1)" strokeWidth="1.8" />
      </svg>
      <div className="chart-metrics">
        <span>Peak demand {peak.toFixed(0)}</span>
        <span>Floor {floor.toFixed(0)}</span>
        <span>Live preview</span>
      </div>
    </article>
  );
}

function AllocationWaterfall({ motoGate }: { motoGate: boolean }) {
  const bars = launchModes.map((mode) => ({
    ...mode,
    share: mode.share + (mode.id === 'gated' && motoGate ? 8 : 0) - (mode.id === 'fair' && motoGate ? 5 : 0),
  }));

  return (
    <article className="panel waterfall-card">
      <header>
        <p className="eyebrow">Allocation</p>
        <h3>Tranche Ladder</h3>
      </header>
      <div className="waterfall">
        {bars.map((bar) => (
          <div key={bar.id} className="waterfall-row">
            <div>
              <p>{bar.label}</p>
              <span>{bar.desc}</span>
            </div>
            <div className="waterfall-bar">
              <div style={{ width: `${bar.share}%` }} />
            </div>
            <strong>{bar.share}%</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function VestingLine({ months }: { months: number }) {
  const items = Array.from({ length: months }, (_, index) => ({
    month: index + 1,
    unlocked: Math.min(100, Math.round(((index + 1) / months) * 100)),
  }));

  return (
    <article className="panel vesting-card">
      <header>
        <p className="eyebrow">Vesting</p>
        <h3>Unlock Spine</h3>
      </header>
      <div className="vesting-grid">
        {items.map((item) => (
          <div key={item.month} className="vesting-item">
            <span>M{item.month}</span>
            <div className="vesting-stick">
              <div style={{ height: `${item.unlocked}%` }} />
            </div>
            <strong>{item.unlocked}%</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function App() {
  const { publicKey, openConnectModal, disconnect, walletAddress, walletBalance, network } = useWalletConnect();
  const [stage, setStage] = useState<Stage>('asset');
  const [launchName, setLaunchName] = useState('PIL Velocity Event');
  const [raiseTarget, setRaiseTarget] = useState('4.20');
  const [months, setMonths] = useState(8);
  const [pillCommit, setPillCommit] = useState(62);
  const [motoGate, setMotoGate] = useState(true);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [contractInput, setContractInput] = useState(DEFAULT_CONTRACT);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('idle');
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const stored = loadContract();
    setContractAddress(stored);
    setContractInput(stored);
  }, []);

  useEffect(() => {
    if (!contractAddress) {
      setRuntimeStatus('idle');
      return;
    }

    if (!isLikelyContract(contractAddress)) {
      setRuntimeStatus('invalid');
      return;
    }

    setRuntimeStatus('live');
  }, [contractAddress]);

  const raise = Number(raiseTarget) || 0;
  const previewMix = useMemo(() => {
    const gated = motoGate ? 'Enabled' : 'Disabled';
    const walletStatus = publicKey ? (walletAddress || 'Connected') : 'Not linked';
    return [
      { label: 'Raise target', value: formatMoney(raise) },
      { label: 'PIL base commit', value: `${pillCommit}%` },
      { label: 'MOTO gate', value: gated },
      { label: 'Wallet', value: walletStatus },
    ];
  }, [motoGate, pillCommit, publicKey, raise, walletAddress]);

  function applyContractAddress() {
    const next = contractInput.trim();
    setContractAddress(next);
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    setNotice({ tone: isLikelyContract(next) ? 'ok' : 'warn', text: next ? 'Contract source updated.' : 'Contract source cleared.' });
  }

  function simulateAction(action: 'publish' | 'pause') {
    setRuntimeStatus('syncing');
    setNotice({ tone: 'ok', text: action === 'publish' ? 'Publishing launch preview...' : 'Pausing live campaign preview...' });
    window.setTimeout(() => {
      setRuntimeStatus(contractAddress && isLikelyContract(contractAddress) ? 'live' : 'idle');
      setNotice({ tone: 'ok', text: action === 'publish' ? 'Launch moved to ready state.' : 'Campaign moved to guarded pause state.' });
    }, 900);
  }

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div>
          <p className="eyebrow">OpenNet Studio</p>
          <h1>Launch Control</h1>
        </div>
        <div className="topbar-actions">
          <span className={`runtime ${runtimeStatus}`}>{runtimeStatus}</span>
          <span className="network-chip">{network?.network || 'wallet idle'}</span>
          {publicKey ? (
            <button type="button" className="wallet-btn" onClick={disconnect}>
              <Wallet size={16} />
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connected'}
            </button>
          ) : (
            <button type="button" className="wallet-btn primary" onClick={openConnectModal}>
              <Wallet size={16} />
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <main className="studio-main">
        <StageRail stage={stage} onStage={setStage} />

        <section className="workbench-grid">
          <article className="panel builder-panel">
            <header>
              <p className="eyebrow">Builder</p>
              <h2>Compose the launch</h2>
            </header>
            <label>
              Launch name
              <input value={launchName} onChange={(event) => setLaunchName(event.target.value)} />
            </label>
            <label>
              Raise target (BTC)
              <input value={raiseTarget} onChange={(event) => setRaiseTarget(event.target.value)} />
            </label>
            <label>
              PIL base commitment ({pillCommit}%)
              <input
                type="range"
                min="25"
                max="80"
                value={pillCommit}
                onChange={(event) => setPillCommit(Number(event.target.value))}
              />
            </label>
            <label>
              Vesting length ({months} months)
              <input
                type="range"
                min="4"
                max="12"
                value={months}
                onChange={(event) => setMonths(Number(event.target.value))}
              />
            </label>
            <label className="toggle-row">
              <span>MOTO holder priority window</span>
              <button
                type="button"
                className={motoGate ? 'toggle active' : 'toggle'}
                onClick={() => setMotoGate((value) => !value)}
              >
                {motoGate ? 'On' : 'Off'}
              </button>
            </label>
            <div className="action-row">
              <button type="button" className="primary wide" onClick={() => simulateAction('publish')}>
                <Play size={16} />
                Publish preview
              </button>
              <button type="button" className="secondary" onClick={() => simulateAction('pause')}>
                <CirclePause size={16} />
                Guard pause
              </button>
            </div>
            <p className="builder-note">{stageNotes[stage]}</p>
          </article>

          <article className="panel preview-panel">
            <header>
              <p className="eyebrow">Live Issuance Preview</p>
              <h2>{launchName}</h2>
            </header>
            <div className="preview-hero">
              <div>
                <span className="hero-pill">
                  <Sparkles size={14} />
                  {motoGate ? 'MOTO priority active' : 'Open participation'}
                </span>
                <h3>{formatMoney(raise)} target with a PIL-first capital stack.</h3>
                <p>
                  This console models a staged launch where PIL powers entry pressure and MOTO unlocks privileged windows.
                </p>
              </div>
              <div className="preview-grid">
                {previewMix.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>
            <div className="status-strip">
              <article>
                <Layers3 size={18} />
                <div>
                  <span>Stack shape</span>
                  <strong>{motoGate ? 'Tiered allocation' : 'Open curve'}</strong>
                </div>
              </article>
              <article>
                <Target size={18} />
                <div>
                  <span>Wallet balance</span>
                  <strong>{walletBalance ? `${(Number(walletBalance.confirmed) / 1e8).toFixed(4)} tBTC` : 'Not linked'}</strong>
                </div>
              </article>
              <article>
                <WandSparkles size={18} />
                <div>
                  <span>Launch thesis</span>
                  <strong>Builder-led campaign</strong>
                </div>
              </article>
            </div>
          </article>
        </section>

        <section className="analytics-grid">
          <RaiseCurve commitment={pillCommit / 2} />
          <AllocationWaterfall motoGate={motoGate} />
          <VestingLine months={months} />

          <article className="panel campaign-panel">
            <header>
              <p className="eyebrow">Campaign State</p>
              <h3>Operator cues</h3>
            </header>
            <div className="campaign-list">
              <article>
                <span className="badge amber">Stage live</span>
                <p>MOTO priority slot opens 20 minutes before the public tranche.</p>
              </article>
              <article>
                <span className="badge cyan">Liquidity guard</span>
                <p>PIL reserve lane remains locked until 34% of the raise target is committed.</p>
              </article>
              <article>
                <span className="badge green">Creator rail</span>
                <p>Creator wallet earns accelerated unlock only after public participation crosses threshold.</p>
              </article>
            </div>
          </article>
        </section>

        <section className="panel contract-panel">
          <header>
            <p className="eyebrow">Contract Source</p>
            <h3>Publish against OpenNet when ready</h3>
          </header>
          <div className="contract-controls">
            <input
              value={contractInput}
              onChange={(event) => setContractInput(event.target.value)}
              placeholder="opt1..."
            />
            <button type="button" className="secondary" onClick={applyContractAddress}>
              Apply
            </button>
            <button type="button" className="secondary" onClick={() => copyText(contractAddress, setNotice)}>
              <Copy size={15} />
              Copy
            </button>
            {contractAddress && (
              <a href={`https://testnet.opscan.org/account/${contractAddress}`} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                Explorer
              </a>
            )}
          </div>
          <p className="contract-hint">
            Runtime stays in demo/live-preview mode until a valid OpenNet contract address is present.
          </p>
          {notice && <p className={`notice ${notice.tone}`}>{notice.text}</p>}
        </section>
      </main>
    </div>
  );
}
