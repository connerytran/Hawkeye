import { useState, useMemo, useEffect } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Trash2 } from "lucide-react";

export interface LogEntry {
  timestamp: string;
  unitId: string;
  action: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface LogViewProps {
  logs: LogEntry[];
  onClear: () => void;
}

const typeConfig: Record<
  LogEntry["type"],
  { label: string; dot: string; text: string; pill: string; pillActive: string }
> = {
  info:    { label: "Info",    dot: "bg-blue-500",   text: "text-blue-600",   pill: "border-blue-200 text-blue-500 hover:bg-blue-50",     pillActive: "bg-blue-100 border-blue-400 text-blue-700 font-semibold" },
  success: { label: "Success", dot: "bg-emerald-500", text: "text-emerald-600", pill: "border-emerald-200 text-emerald-600 hover:bg-emerald-50", pillActive: "bg-emerald-100 border-emerald-400 text-emerald-700 font-semibold" },
  warning: { label: "Warn",    dot: "bg-amber-500",  text: "text-amber-600",  pill: "border-amber-200 text-amber-500 hover:bg-amber-50",   pillActive: "bg-amber-100 border-amber-400 text-amber-700 font-semibold" },
  error:   { label: "Error",   dot: "bg-red-500",    text: "text-red-600",    pill: "border-red-200 text-red-500 hover:bg-red-50",        pillActive: "bg-red-100 border-red-400 text-red-700 font-semibold" },
};

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function LogView({ logs, onClear }: LogViewProps) {
  // Empty set = "all" (no filter active)
  const [activeTypes, setActiveTypes] = useState<Set<LogEntry["type"]>>(new Set());
  const [activeUnits, setActiveUnits] = useState<Set<string>>(new Set());

  // Unique source IDs that have appeared in the log
  const unitIds = useMemo(
    () => [...new Set(logs.map((l) => l.unitId))].sort(),
    [logs]
  );

  // Drop stale filter selections when unitIds change (e.g. after a rename)
  useEffect(() => {
    const validIds = new Set(unitIds);
    setActiveUnits((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size !== prev.size ? next : prev;
    });
  }, [unitIds]);

  const filtered = useMemo(
    () =>
      logs.filter(
        (l) =>
          (activeTypes.size === 0 || activeTypes.has(l.type)) &&
          (activeUnits.size === 0 || activeUnits.has(l.unitId))
      ),
    [logs, activeTypes, activeUnits]
  );

  const hasFilters = activeTypes.size > 0 || activeUnits.size > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* ── Header ── */}
      <div className="border-b border-gray-200 px-5 py-3 flex flex-wrap items-center gap-3">
        {/* Title + count */}
        <div className="flex items-center gap-2 mr-auto">
          <h2 className="text-base font-semibold text-gray-900">Activity Log</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-mono">
            {filtered.length}{filtered.length !== logs.length ? ` / ${logs.length}` : ""}
          </span>
          {hasFilters && (
            <button
              onClick={() => { setActiveTypes(new Set()); setActiveUnits(new Set()); }}
              className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors"
            >
              reset
            </button>
          )}
        </div>

        {/* Type filters — multiselect */}
        <div className="flex items-center gap-1 flex-wrap">
          {(["success", "info", "error", "warning"] as LogEntry["type"][]).map((t) => {
            const active = activeTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => setActiveTypes((prev) => toggleSet(prev, t))}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                  active ? typeConfig[t].pillActive : typeConfig[t].pill
                }`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${typeConfig[t].dot}`} />
                {typeConfig[t].label}
              </button>
            );
          })}
        </div>

        {/* Clear button */}
        <button
          onClick={() => {
            onClear();
            setActiveTypes(new Set());
            setActiveUnits(new Set());
          }}
          disabled={logs.length === 0}
          title="Clear log"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {/* ── Pi filter tabs — multiselect (only shows when >1 unit in log) ── */}
      {unitIds.length > 1 && (
        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400 mr-1">Source:</span>
          {unitIds.map((id) => {
            const active = activeUnits.has(id);
            return (
              <button
                key={id}
                onClick={() => setActiveUnits((prev) => toggleSet(prev, id))}
                className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                  active
                    ? "bg-red-600 border-red-600 text-white font-semibold"
                    : "border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-300"
                }`}
              >
                {id}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Log entries ── */}
      <ScrollArea className="h-56">
        <div className="p-4 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {logs.length === 0 ? "No activity logged yet" : "No entries match the current filters"}
            </p>
          ) : (
            filtered.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-3 text-xs font-mono py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${typeConfig[log.type].dot}`} />
                <span className="text-gray-400 min-w-[64px] flex-shrink-0">{log.timestamp}</span>
                <span className="font-semibold text-gray-700 min-w-[56px] flex-shrink-0">{log.unitId}</span>
                <span className="text-gray-500 min-w-[110px] flex-shrink-0">{log.action}</span>
                <span className={`${typeConfig[log.type].text} flex-1`}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
