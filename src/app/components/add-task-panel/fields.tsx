import { P } from './constants';
import type { SelectOption } from './deviceFunctionSets';
import { Checkbox } from '../ui/checkbox';

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 5 }}>
      <span style={{ fontSize: 12, color: P.text50 }}>{label}</span>
      {children}
    </div>
  );
}

export function InlineField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid items-center gap-[10px]"
      style={{ gridTemplateColumns: 'minmax(128px, 190px) minmax(0, 1fr)' }}
    >
      <span style={{ fontSize: 12, color: P.text50 }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

export const INPUT_STYLE: React.CSSProperties = {
  height: 32,
  backgroundColor: P.ink950,
  border: `1px solid ${P.surface600}`,
  color: P.text50,
  fontSize: 12,
  paddingLeft: 8,
  paddingRight: 8,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export const PANEL_BUTTON_HEIGHT = 32;
export const PURPLE_ACCENT_TEXT = '#F9FAFB';
export const ACTION_ADD_BG_SOFT = '#111B2E';
export const ACTION_ADD_BORDER = '#324056';
export const ACTION_UPDATE_BG_SOFT = '#111B2E';
export const ACTION_UPDATE_BORDER = '#324056';
export const ACTION_APPLY_BG = '#111B2E';
export const ACTION_APPLY_BG_SOFT = '#111B2E';
export const ACTION_APPLY_BORDER = '#324056';
export const ACTION_CLOSE_BG = '#111B2E';
export const ACTION_CLOSE_BORDER = '#324056';
export const ACTION_CLOSE_TEXT = '#E5EAF3';
export const ACTION_HOVER_OUTLINE_CLASS =
  'hover:shadow-[0_0_0_1px_#8E51FF] focus-visible:shadow-[0_0_0_1px_#8E51FF] active:shadow-[0_0_0_1px_#8E51FF] focus-visible:outline-none disabled:hover:shadow-none';


export function SelectField({
  value,
  options,
  onChange,
  placeholder = '',
  includeEmptyOption = true,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  includeEmptyOption?: boolean;
}) {
  const resolvedPlaceholder = placeholder.trim() || 'Select';
  return (
    <div className="relative" style={{ width: '100%' }}>
      <select
        className="appearance-none w-full outline-none cursor-pointer app-scrollbar transition-colors hover:border-[#8E51FF] focus:border-[#8E51FF] focus:shadow-[0_0_0_1px_rgba(142,81,255,0.35)]"
        style={{ ...INPUT_STYLE, paddingRight: 24 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {includeEmptyOption ? (
          <option value="">{resolvedPlaceholder}</option>
        ) : null}
        {options.map((option) => {
          const optionValue =
            typeof option === 'string' ? option : option.value;
          const optionLabel =
            typeof option === 'string' ? option : option.label;
          return (
            <option
              key={optionValue}
              value={optionValue}
              style={{ backgroundColor: P.ink950 }}
            >
              {optionLabel}
            </option>
          );
        })}
      </select>
      {/* Chevron */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ right: 4 }}
      >
        <path
          d="M4 6L8 10L12 6"
          stroke={P.surface700}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.33333"
        />
      </svg>
    </div>
  );
}

export function isBooleanSelectOptions(options: SelectOption[]): boolean {
  if (options.length !== 2) return false;
  const normalized = new Set(
    options.map((option) =>
      (typeof option === 'string' ? option : option.value).trim().toLowerCase()
    )
  );
  return normalized.has('true') && normalized.has('false');
}

export function BooleanCheckboxField({
  value,
  onChange,
  label = 'Enabled',
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const checked = value.trim().toLowerCase() === 'true';
  return (
    <label
      className="inline-flex items-center gap-2 cursor-pointer select-none"
      style={{ color: P.text50, fontSize: 12 }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(nextChecked) =>
          onChange(nextChecked ? 'true' : 'false')
        }
      />
      <span>{label}</span>
    </label>
  );
}

// ── Task row ───────────────────────────────────────────────────────────────────

// ── Main component ─────────────────────────────────────────────────────────────

