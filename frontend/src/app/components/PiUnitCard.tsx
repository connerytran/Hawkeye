import { Play, Square, ArrowUpDown, Trash2, Edit2, Check, X, Camera, Loader2, Eraser, ChevronDown } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { useState, useRef, useEffect } from "react";

export type PiStatus = "online" | "offline" | "busy" | "error" | "connecting";

export interface TransferInfo {
  status: string;
  nice_status: string;
  files: number;
  files_transferred: number;
  bytes_transferred: number;
  subtasks_succeeded: number;
  subtasks_total: number;
}

export interface PiUnit {
  id: string;
  status: PiStatus;
  lastResponse: string;
  lastResponseTime: string;
  hostname: string;
  transfer?: TransferInfo | null;
  autoClear?: boolean;
}

interface PiUnitCardProps {
  unit: PiUnit;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
  onStartCapture: () => void;
  onStopCapture: () => void;
  onGlobusTransfer: () => void;
  onClearPhotos: () => void;
  onToggleAutoClear: () => void;
  onRemove: () => void;
  onRename: (newId: string) => void;
  onUpdateHostname: (newHostname: string) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

const statusConfig = {
  online: {
    label: "Online",
    className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  },
  offline: {
    label: "Offline",
    className: "bg-gray-400/10 text-gray-600 border border-gray-400/20",
  },
  busy: {
    label: "Busy",
    className: "bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse",
  },
  error: {
    label: "Error",
    className: "bg-red-600/10 text-red-600 border border-red-600/20",
  },
  connecting: {
    label: "Connecting...",
    className: "bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse",
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function PiUnitCard({
  unit,
  selected,
  onSelectChange,
  onStartCapture,
  onStopCapture,
  onGlobusTransfer,
  onClearPhotos,
  onToggleAutoClear,
  onRemove,
  onRename,
  onUpdateHostname,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
}: PiUnitCardProps) {
  const statusStyle = statusConfig[unit.status];
  const isOffline = unit.status === "offline";
  const isUnavailable = isOffline || unit.status === "connecting";

  const handleCardClick = () => {
    if (!isUnavailable) onSelectChange(!selected);
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState(unit.id);
  const [editHostname, setEditHostname] = useState(unit.hostname);

  const handleInputClick = (e: React.MouseEvent) => e.stopPropagation();

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(unit.id);
    setEditHostname(unit.hostname);
    setIsEditMode(true);
  };

  const saveEdit = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (editName.trim() && editName.trim() !== unit.id) onRename(editName.trim());
    if (editHostname.trim() && editHostname.trim() !== unit.hostname) onUpdateHostname(editHostname.trim());
    setIsEditMode(false);
  };

  const cancelEdit = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setIsEditMode(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit(e);
    else if (e.key === "Escape") cancelEdit(e);
  };

  const [captureOpen, setCaptureOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const captureDropRef = useRef<HTMLDivElement>(null);
  const transferDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!captureDropRef.current?.contains(e.target as Node)) setCaptureOpen(false);
      if (!transferDropRef.current?.contains(e.target as Node)) setTransferOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      draggable={!isEditMode}
      onClick={handleCardClick}
      onDragStart={(e) => {
        if (isEditMode) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragEnd={onDragEnd}
      className={`
        relative rounded-xl bg-white border-2 shadow-sm
        transition-all duration-200 ease-out select-none
        ${captureOpen || transferOpen ? "z-20" : "z-0"}
        ${isDragging ? "opacity-40 scale-95" : ""}
        ${isDragOver ? "border-red-400 shadow-[0_0_0_3px_rgba(204,0,0,0.15)] -translate-y-1" : ""}
        ${!isDragging && !isDragOver ? (isOffline ? "cursor-grab" : "cursor-grab hover:shadow-lg hover:-translate-y-0.5") : ""}
        ${selected && !isDragOver ? "border-red-600 shadow-[0_0_0_3px_rgba(204,0,0,0.1)]" : !isDragOver ? "border-gray-200 hover:border-gray-300" : ""}
      `}
    >
      {/* Checkbox */}
      <div className="absolute top-4 left-4 z-10" onClick={handleCheckboxClick}>
        <Checkbox
          checked={selected}
          onCheckedChange={onSelectChange}
          disabled={isUnavailable}
          className="border-gray-300 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Top-right edit controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-1" onClick={(e) => e.stopPropagation()}>
        {isEditMode ? (
          <>
            <Button variant="ghost" size="sm" onClick={saveEdit} className="p-1 h-7 w-7 hover:bg-green-50">
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit} className="p-1 h-7 w-7 hover:bg-red-50">
              <X className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={openEdit} className="p-1 h-7 w-7 hover:bg-gray-100 opacity-50 hover:opacity-100">
            <Edit2 className="h-3.5 w-3.5 text-gray-600" />
          </Button>
        )}
      </div>

      {/* Card Content */}
      <div className="p-6 pt-12">
        {/* Unit ID */}
        <div className="flex items-center gap-2 mb-3">
          {isEditMode ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onClick={handleInputClick}
              onKeyDown={handleEditKeyDown}
              className="font-mono text-lg flex-1 border border-red-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-600"
              autoFocus
            />
          ) : (
            <h3 className="font-mono text-lg font-semibold">{unit.id}</h3>
          )}
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusStyle.className}`}>
            {statusStyle.label}
          </span>
        </div>

        {/* Hostname */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Hostname</p>
          {isEditMode ? (
            <input
              type="text"
              value={editHostname}
              onChange={(e) => setEditHostname(e.target.value)}
              onClick={handleInputClick}
              onKeyDown={handleEditKeyDown}
              className="font-mono text-sm w-full border border-red-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-600"
            />
          ) : (
            <p className="text-sm font-mono text-gray-900">{unit.hostname}</p>
          )}
        </div>

        {/* Capture Status */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">Capture</span>
          <div className="flex items-center gap-1.5">
            {unit.status === "busy" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                <span className="text-xs font-medium text-amber-600">Active</span>
              </>
            ) : unit.status === "online" ? (
              <>
                <Camera className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-gray-500">Idle</span>
              </>
            ) : unit.status === "connecting" ? (
              <>
                <Camera className="h-3.5 w-3.5 text-blue-300 animate-pulse" />
                <span className="text-xs font-medium text-gray-400">—</span>
              </>
            ) : (
              <>
                <Camera className="h-3.5 w-3.5 text-gray-300" />
                <span className="text-xs font-medium text-gray-400">—</span>
              </>
            )}
          </div>
        </div>

        {/* Transfer Status Bar */}
        {(() => {
          const t = unit.transfer;
          const isActive = t?.status === "ACTIVE";
          const isSucceeded = t?.status === "SUCCEEDED";
          const isFailed = t?.status === "FAILED";
          const isInactive = t?.status === "INACTIVE";
          const hasProgress = !!(t && t.subtasks_total > 0);
          const pct = hasProgress
            ? Math.round((t!.subtasks_succeeded / t!.subtasks_total) * 100)
            : isSucceeded ? 100 : 0;

          const statusLabel = isActive && hasProgress
            ? `${pct}%`
            : isSucceeded ? "Complete"
            : isFailed ? "Failed"
            : isInactive ? "Cancelled"
            : t ? (t.nice_status || t.status)
            : "—";

          return (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Upload</span>
                <span className={`text-xs font-medium ${isFailed || isInactive ? "text-red-500" : isSucceeded ? "text-emerald-600" : "text-gray-700"}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                {isFailed || isInactive ? (
                  <div className="h-full w-full rounded-full bg-red-400" />
                ) : isSucceeded ? (
                  <div className="h-full w-full rounded-full bg-emerald-500" />
                ) : isActive && hasProgress ? (
                  <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                ) : isActive ? (
                  <div className="h-full w-full bg-blue-500 rounded-full animate-[captureSlide_1.5s_ease-in-out_infinite]" />
                ) : null}
              </div>
              {t && t.bytes_transferred > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5 text-right">
                  {isSucceeded
                    ? `${t.files_transferred} files · ${formatBytes(t.bytes_transferred)}`
                    : isActive && hasProgress
                    ? `${t.subtasks_succeeded}/${t.subtasks_total} files · ${formatBytes(t.bytes_transferred)}`
                    : `${formatBytes(t.bytes_transferred)} transferred`}
                </p>
              )}
            </div>
          );
        })()}

        {/* Action Dropdowns */}
        <div className="flex gap-2 items-center">
          {/* Capture Controls */}
          <div className="relative flex-1" ref={captureDropRef}>
            <button
              onClick={(e) => { e.stopPropagation(); if (!isUnavailable) { setCaptureOpen((o) => !o); setTransferOpen(false); } }}
              disabled={isUnavailable}
              className="w-full flex items-center justify-between gap-1 text-[10px] px-2 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="flex items-center gap-1">
                <Camera className="h-3 w-3" />
                <span>Capture</span>
              </div>
              <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${captureOpen ? "rotate-180" : ""}`} />
            </button>
            {captureOpen && (
              <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setCaptureOpen(false); if (!isUnavailable) onStartCapture(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Play className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  Start Capture
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCaptureOpen(false); if (!isUnavailable) onStopCapture(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Square className="h-3 w-3 text-red-500 flex-shrink-0" />
                  Stop Capture
                </button>
              </div>
            )}
          </div>

          {/* Transfer Controls */}
          <div className="relative flex-1" ref={transferDropRef}>
            <button
              onClick={(e) => { e.stopPropagation(); if (!isUnavailable) { setTransferOpen((o) => !o); setCaptureOpen(false); } }}
              disabled={isUnavailable}
              className="w-full flex items-center justify-between gap-1 text-[10px] px-2 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" />
                <span>Transfer</span>
              </div>
              <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${transferOpen ? "rotate-180" : ""}`} />
            </button>
            {transferOpen && (
              <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setTransferOpen(false); if (!isUnavailable) onGlobusTransfer(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowUpDown className="h-3 w-3 text-blue-500 flex-shrink-0" />
                  Begin Transfer
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (unit.transfer?.status !== "ACTIVE") { setTransferOpen(false); if (!isUnavailable) onClearPhotos(); } }}
                  disabled={unit.transfer?.status === "ACTIVE"}
                  title={unit.transfer?.status === "ACTIVE" ? "Cannot clear while upload is in progress" : undefined}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Eraser className="h-3 w-3 flex-shrink-0" />
                  Clear Photos
                </button>
                <div
                  className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onToggleAutoClear(); }}
                >
                  <input
                    type="checkbox"
                    checked={unit.autoClear ?? false}
                    onChange={() => {}}
                    className="h-3 w-3 accent-red-600 pointer-events-none"
                  />
                  <span className="text-[10px] text-gray-600 select-none leading-tight">
                    Auto-clear after upload
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Remove button */}
          <button
            onClick={handleRemoveClick}
            title="Remove Pi"
            className="p-1.5 rounded border border-red-200 text-red-400 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}