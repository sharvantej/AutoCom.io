import { useNavigate } from "react-router";
import { useTheme } from "../context/AppContext";

type T = ReturnType<typeof useTheme>;

type GuideStep = {
  title: string;
  body: string;
};

const STEPS: GuideStep[] = [
  {
    title: "1. Add your devices",
    body: "Go to Connections and add each device on your network (vMix, ATEM, OBS, X32, grandMA, Ross switchers, or any generic OSC/TCP/HTTP endpoint) with its IP and port.",
  },
  {
    title: "2. Create a project",
    body: "Open the File menu and choose New Project to start a show file — pick where to save it, just like any other document. Each project is its own file with its own control-panel layout.",
  },
  {
    title: "3. Enter edit mode",
    body: "With a project open, click \"Edit Dashboard\" (or press G) to reveal the toolbar and grid. Press G again, or Esc, to leave edit mode.",
  },
  {
    title: "4. Add buttons",
    body: "With the Button tool selected, click and drag on the grid to place a button. Double-click it to attach one or more tasks — each task fires a command on one of your connections.",
  },
  {
    title: "5. Go live",
    body: "Leave edit mode and click a button to run its tasks. Use Button Mapping to put the same tasks on a physical Stream Deck.",
  },
];

function StepCard({ step, t }: { step: GuideStep; t: T }) {
  return (
    <div
      className="px-[16px] py-[14px]"
      style={{ border: `1px solid ${t.divider}`, backgroundColor: t.bgSidebar }}
    >
      <div className="text-[13px] font-semibold" style={{ color: t.textPrimary }}>
        {step.title}
      </div>
      <div className="text-[12px] mt-[6px]" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
        {step.body}
      </div>
    </div>
  );
}

export default function UserGuide() {
  const t = useTheme();
  const navigate = useNavigate();

  return (
    <div
      className="flex-1 overflow-y-auto page-pop"
      style={{ backgroundColor: t.bgOuter, fontFamily: "'JetBrains Mono', monospace" }}
    >
      <div className="max-w-[720px] mx-auto px-[24px] py-[28px] flex flex-col gap-[18px]">
        <div>
          <div className="text-[16px] font-semibold" style={{ color: t.textPrimary }}>
            Getting started with Autocom
          </div>
          <div className="text-[12px] mt-[4px]" style={{ color: t.textMuted }}>
            Build a clickable control panel that fires real commands at your live-production gear.
          </div>
        </div>

        <div className="flex flex-col gap-[10px]">
          {STEPS.map((step) => (
            <StepCard key={step.title} step={step} t={t} />
          ))}
        </div>

        <button
          type="button"
          className="self-start text-[12px] underline"
          style={{ color: t.textSecondary }}
          onClick={() => navigate("/settings")}
        >
          See the full keyboard shortcut list in Settings → Shortcuts
        </button>
      </div>
    </div>
  );
}
