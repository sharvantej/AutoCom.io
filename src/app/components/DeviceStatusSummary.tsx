import type { AppTheme, Connection } from "../context/AppContext";
import type { DeviceStatusPayload } from "../services/events";

const ONLINE_DEVICE_DOT = "#22c55e";
const OFFLINE_DEVICE_DOT = "#ef4444";
const NEUTRAL_DEVICE_DOT = "#94a3b8";

function resolveStatusByName(
  statuses: Record<string, DeviceStatusPayload>,
  name: string,
): DeviceStatusPayload | undefined {
  if (statuses[name]) return statuses[name];
  const key = name.trim().toLowerCase();
  return Object.entries(statuses).find(
    ([deviceName]) => deviceName.trim().toLowerCase() === key,
  )?.[1];
}

function statusDotColor(status: string): string {
  if (status === "online") return ONLINE_DEVICE_DOT;
  if (status === "offline") return OFFLINE_DEVICE_DOT;
  return NEUTRAL_DEVICE_DOT;
}

type Props = {
  connections: Connection[];
  statuses: Record<string, DeviceStatusPayload>;
  t: AppTheme;
  label?: string;
};

export function DeviceStatusSummary({
  connections,
  statuses,
  t,
  label = "Active Devices :",
}: Props) {
  const visibleConnections = connections.filter((connection) => connection.active);
  if (!visibleConnections.length) return null;
  const rowsPerColumn = 2;
  const columns: Connection[][] = [];
  for (let i = 0; i < visibleConnections.length; i += rowsPerColumn) {
    columns.push(visibleConnections.slice(i, i + rowsPerColumn));
  }

  return (
    <div className="shrink-0 flex items-center gap-[8px]">
      {label ? (
        <span className="text-[12px]" style={{ color: t.textSecondary }}>
          {label}
        </span>
      ) : null}
      <div className="flex flex-row-reverse items-start gap-[6px]">
        {columns.map((column, columnIndex) => (
          <div key={`col-${columnIndex}`} className="flex flex-col gap-[2px]" style={{ width: "11.5ch" }}>
            {column.map((connection) => {
              const statusInfo = resolveStatusByName(statuses, connection.name);
              const status = String(statusInfo?.status ?? "unknown").trim().toLowerCase();
              const dot = statusDotColor(status);
              const textOpacity = status === "online" ? 1 : 0.8;

              return (
                <div
                  key={connection.id}
                  className="flex items-center gap-[4px] justify-start w-full"
                  title={`Status: ${status}`}
                  style={{ opacity: textOpacity }}
                >
                  <div
                    className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ backgroundColor: dot }}
                  />
                  <span
                    className="text-[12px] whitespace-nowrap text-left overflow-hidden text-ellipsis"
                    style={{ color: t.textSecondary }}
                  >
                    {connection.name}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
