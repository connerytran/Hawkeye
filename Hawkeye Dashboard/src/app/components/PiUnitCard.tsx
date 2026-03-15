import { Play, Square, ArrowUpDown, Trash2, Edit2, Check, X, Camera, Loader2 } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { useState } from "react";

export type PiStatus = "online" | "offline" | "busy" | "error" | "connecting";

export interface TransferInfo {
  status: string;       // machine-readable: ACTIVE, SUCCEEDED, FAILED, INACTIVE
  nice_status: string;  // human-readable: "Ok", "Queued", etc.
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
  ipAddress: string;
  transfer?: TransferInfo | null;
}

interface PiUnitCardProps {
  unit: PiUnit;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
  onStartCapture: () => void;
  onStopCapture: () => void;
  onGlobusTransfer: () => void;
  onRemove: () => void;
  onRename: (newId: string) => void;
  onUpdateIp: (newIp: string) => void;
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
  onRemove,
  onRename,
  onUpdateIp,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
}: PiUnitCardProps) {
  const statusStyle = statusConfig[unit.status];
  const isOffline = unit.status === "offline";

  const handleCardClick = () => {
    if (!isOffline) {
      onSelectChange(!selected);
    }
  };

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation(); // Prevent card selection when clicking buttons
    if (!isOffline) {
      action();
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking remove
    onRemove();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent double-toggle
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState(unit.id);
  const [editIp, setEditIp] = useState(unit.ipAddress);

  const handleInputClick = (e: React.MouseEvent) => e.stopPropagation();

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(unit.id);
    setEditIp(unit.ipAddress);
    setIsEditMode(true);
  };

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editName.trim() && editName !== unit.id) onRename(editName.trim());
    if (editIp.trim() && editIp !== unit.ipAddress) onUpdateIp(editIp.trim());
    setIsEditMode(false);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit(e as unknown as React.MouseEvent);
    else if (e.key === 'Escape') { setIsEditMode(false); }
  };

  return (
    <div
      draggable={!isEditMode}
      onClick={handleCardClick}
      onDragStart={(e) => { if (isEditMode) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragEnd={onDragEnd}
      className={`
        relative rounded-xl bg-white border-2 shadow-sm
        transition-all duration-200 ease-out select-none
        ${isDragging ? 'opacity-40 scale-95' : ''}
        ${isDragOver ? 'border-red-400 shadow-[0_0_0_3px_rgba(204,0,0,0.15)] -translate-y-1' : ''}
        ${!isDragging && !isDragOver ? (isOffline ? 'cursor-grab' : 'cursor-grab hover:shadow-lg hover:-translate-y-0.5') : ''}
        ${selected && !isDragOver ? "border-red-600 shadow-[0_0_0_3px_rgba(204,0,0,0.1)]" : !isDragOver ? "border-gray-200 hover:border-gray-300" : ""}
      `}
    >
      {/* Checkbox */}
      <div className="absolute top-4 left-4 z-10" onClick={handleCheckboxClick}>
        <Checkbox
          checked={selected}
          onCheckedChange={onSelectChange}
          disabled={isOffline}
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
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusStyle.className}`}
          >
            {statusStyle.label}
          </span>
        </div>

        {/* IP Address */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">IP Address</p>
          {isEditMode ? (
            <input
              type="text"
              value={editIp}
              onChange={(e) => setEditIp(e.target.value)}
              onClick={handleInputClick}
              onKeyDown={handleEditKeyDown}
              className="font-mono text-sm w-full border border-red-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-600"
            />
          ) : (
            <p className="text-sm font-mono text-gray-900">{unit.ipAddress}</p>
          )}
        </div>

        {/* Capture Status Indicator */}
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

        {/* Upload / Transfer Status Bar */}
        {(() => {
          const t = unit.transfer;
          const isActive = t?.status === "ACTIVE";
          const isSucceeded = t?.status === "SUCCEEDED";
          const isFailed = t?.status === "FAILED";
          const hasProgress = !!(t && t.subtasks_total > 0);
          const pct = hasProgress
            ? Math.round((t!.subtasks_succeeded / t!.subtasks_total) * 100)
            : isSucceeded ? 100 : 0;

          return (
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Upload</span>
                <span className="text-xs font-medium text-gray-700">
                  {t ? (hasProgress && isActive ? `${pct}%` : t.nice_status || t.status) : "—"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                {isFailed ? (
                  <div className="h-full w-full rounded-full bg-red-500" />
                ) : isSucceeded ? (
                  <div className="h-full w-full rounded-full bg-emerald-500" />
                ) : isActive && hasProgress ? (
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
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

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => handleButtonClick(e, onStartCapture)}
            disabled={isOffline}
            className="flex-1 min-w-0 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] px-2"
          >
            <Play className="h-3 w-3 mr-0.5" />
            Start
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => handleButtonClick(e, onStopCapture)}
            disabled={isOffline}
            className="flex-1 min-w-0 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] px-2"
          >
            <Square className="h-3 w-3 mr-0.5" />
            Stop
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => handleButtonClick(e, onGlobusTransfer)}
            disabled={isOffline}
            className="flex-1 min-w-0 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] px-2"
          >
            <ArrowUpDown className="h-3 w-3 mr-0.5" />
            Transfer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveClick}
            className="flex-1 min-w-0 border-red-600 bg-white hover:bg-red-50 text-red-600 text-[10px] px-2"
          >
            <Trash2 className="h-3 w-3 mr-0.5" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}