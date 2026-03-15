import { Play, Square, ArrowUpDown, Trash2, Edit2, Check, X } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { useState } from "react";

export type PiStatus = "online" | "offline" | "busy" | "error";

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

  const [isEditing, setIsEditing] = useState(false);
  const [newId, setNewId] = useState(unit.id);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (newId.trim() && newId !== unit.id) {
      onRename(newId.trim());
    }
    setIsEditing(false);
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewId(unit.id);
    setIsEditing(false);
  };

  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (newId.trim() && newId !== unit.id) {
        onRename(newId.trim());
      }
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setNewId(unit.id);
      setIsEditing(false);
    }
  };

  const [isEditingIp, setIsEditingIp] = useState(false);
  const [newIp, setNewIp] = useState(unit.ipAddress);

  const handleEditIpClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewIp(unit.ipAddress);
    setIsEditingIp(true);
  };

  const handleSaveIpClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (newIp.trim() && newIp !== unit.ipAddress) {
      onUpdateIp(newIp.trim());
    }
    setIsEditingIp(false);
  };

  const handleCancelIpClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewIp(unit.ipAddress);
    setIsEditingIp(false);
  };

  const handleIpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (newIp.trim() && newIp !== unit.ipAddress) {
        onUpdateIp(newIp.trim());
      }
      setIsEditingIp(false);
    } else if (e.key === 'Escape') {
      setNewIp(unit.ipAddress);
      setIsEditingIp(false);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        relative rounded-xl bg-white border-2 shadow-sm
        transition-all duration-200 ease-out
        ${isOffline ? 'cursor-default' : 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5'}
        ${
          selected
            ? "border-red-600 shadow-[0_0_0_3px_rgba(204,0,0,0.1)]"
            : "border-gray-200 hover:border-gray-300"
        }
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

      {/* Card Content */}
      <div className="p-6 pt-12">
        {/* Unit ID */}
        <div className="flex items-center gap-2 mb-3">
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                onClick={handleInputClick}
                onKeyDown={handleKeyDown}
                className="font-mono text-lg flex-1 border border-red-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-600"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveClick}
                className="p-0.5 h-6 w-6 hover:bg-green-50"
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelClick}
                className="p-0.5 h-6 w-6 hover:bg-red-50"
              >
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          ) : (
            <>
              <h3 className="font-mono text-lg font-semibold">{unit.id}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditClick}
                className="p-1 h-6 w-6 hover:bg-gray-100 opacity-60 hover:opacity-100"
              >
                <Edit2 className="h-3.5 w-3.5 text-gray-600" />
              </Button>
            </>
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
          {isEditingIp ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                onClick={handleInputClick}
                onKeyDown={handleIpKeyDown}
                className="font-mono text-sm flex-1 border border-red-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-600"
                autoFocus
              />
              <Button variant="ghost" size="sm" onClick={handleSaveIpClick} className="p-0.5 h-6 w-6 hover:bg-green-50">
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancelIpClick} className="p-0.5 h-6 w-6 hover:bg-red-50">
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-sm font-mono text-gray-900">{unit.ipAddress}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditIpClick}
                className="p-1 h-6 w-6 hover:bg-gray-100 opacity-60 hover:opacity-100"
              >
                <Edit2 className="h-3 w-3 text-gray-600" />
              </Button>
            </div>
          )}
        </div>

        {/* Last Response */}
        <div className="mb-4">
          <p className="text-xs font-mono text-gray-500">
            {unit.lastResponse} · {unit.lastResponseTime}
          </p>
        </div>

        {/* Capture Status Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">Capture</span>
            <span className="text-xs font-medium text-gray-700">
              {unit.status === "busy" ? "Active" : unit.status === "offline" ? "—" : "Idle"}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            {unit.status === "busy" ? (
              <div className="h-full w-full bg-amber-500 rounded-full animate-[captureSlide_1.5s_ease-in-out_infinite]" />
            ) : unit.status === "online" ? (
              <div className="h-full w-1/4 bg-emerald-400 rounded-full" />
            ) : (
              <div className="h-full w-0" />
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