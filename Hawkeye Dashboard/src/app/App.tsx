import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Square, ArrowUpDown, RefreshCw, Plus } from "lucide-react";
import { PiUnitCard, PiUnit, PiStatus, TransferInfo } from "./components/PiUnitCard";
import { LogView, LogEntry } from "./components/LogView";
import { Checkbox } from "./components/ui/checkbox";
import { Button } from "./components/ui/button";
import ncsuLogo from "../assets/Ncsu_psi.png";

const BACKEND_URL = "http://localhost:8000";

const initialPiUnits: PiUnit[] = [
  {
    id: "Pi-01",
    status: "connecting" as PiStatus,
    lastResponse: "—",
    lastResponseTime: "—",
    ipAddress: "192.168.2.97",
  },
];

function extractError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") {
    if (err.includes("Connection refused"))          return "Connection refused";
    if (err.includes("timed out") || err.includes("Timeout") || err.includes("timeout")) return "Connection timed out";
    if (err.includes("Failed to establish") || err.includes("NewConnectionError")) return "Host unreachable";
    if (err.includes("Name or service not known") || err.includes("getaddrinfo")) return "Host not found";
    return err.length > 100 ? err.slice(0, 100) + "…" : err;
  }
  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    if (o.detail)  return String(o.detail);
    if (o.message) return String(o.message);
    if (o.error)   return extractError(o.error);
    const s = JSON.stringify(err);
    return s.length > 100 ? s.slice(0, 100) + "…" : s;
  }
  return String(err);
}

function getTimestamp() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
}

export default function App() {
  const [piUnits, setPiUnits] = useState<PiUnit[]>(initialPiUnits);
  const piUnitsRef = useRef(piUnits);
  useEffect(() => { piUnitsRef.current = piUnits; }, [piUnits]);

  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState("");
  const [transferModal, setTransferModal] = useState<{ target: "bulk" | string } | null>(null);
  const [modalFolder, setModalFolder] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const MAX_LOG_ENTRIES = 200;

  function addLog(unitId: string, action: string, message: string, type: "success" | "error" | "info") {
    setLogs((prev) => {
      const next = [{ timestamp: getTimestamp(), unitId, action, message, type }, ...prev];
      return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next;
    });
  }

  function clearLogs() {
    setLogs([]);
  }

  function getSelectedIps(): string[] {
    return piUnits
      .filter((u) => selectedUnits.has(u.id))
      .map((u) => u.ipAddress);
  }

  // ===== REFRESH / STATUS =====
  const pollStatuses = useCallback(async (silent = false, overrideIps?: string[]) => {
    const currentUnits = piUnitsRef.current;
    const ips = overrideIps ?? currentUnits.map((u) => u.ipAddress);
    if (ips.length === 0) return;

    try {
      const [captureRes, transferRes] = await Promise.all([
        fetch(`${BACKEND_URL}/capture-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        }),
        fetch(`${BACKEND_URL}/transfer-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        }),
      ]);
      const captureData = await captureRes.json();
      const transferData = await transferRes.json();

      // Build updated units and detect ACTIVE→SUCCEEDED transitions for auto-delete
      const justCompleted: string[] = [];

      const updatedUnits = currentUnits.map((unit) => {
        const captureResult = captureData.results?.[unit.ipAddress];
        const transferResult = transferData.results?.[unit.ipAddress];

        if (!captureResult || captureResult.error) {
          if (unit.status !== "offline") {
            const reason = extractError(captureResult?.error);
            addLog(unit.id, "Connection", `Went offline — ${reason}`, "error");
          }
          return { ...unit, status: "offline" as PiStatus, lastResponse: "Offline", lastResponseTime: "just now", transfer: null };
        }
        if (unit.status === "offline") {
          addLog(unit.id, "Connection", "Back online", "success");
        }
        const capturing = captureResult.capture_status === "Capturing";

        const transfer: TransferInfo | null =
          transferResult && !transferResult.error
            ? {
                status: transferResult.status ?? "",
                nice_status: transferResult.nice_status ?? "",
                files: transferResult.files ?? 0,
                files_transferred: transferResult.files_transferred ?? 0,
                bytes_transferred: transferResult.bytes_transferred ?? 0,
                subtasks_succeeded: transferResult.subtasks_succeeded ?? 0,
                subtasks_total: transferResult.subtasks_total ?? 0,
              }
            : null;

        // Detect transition: was ACTIVE, now SUCCEEDED
        if (unit.transfer?.status === "ACTIVE" && transfer?.status === "SUCCEEDED") {
          justCompleted.push(unit.ipAddress);
        }

        return {
          ...unit,
          status: capturing ? ("busy" as PiStatus) : ("online" as PiStatus),
          lastResponse: captureResult.capture_status,
          lastResponseTime: "just now",
          transfer,
        };
      });

      setPiUnits(updatedUnits);

      // Auto-delete photos on completed transfers
      if (justCompleted.length > 0) {
        try {
          await fetch(`${BACKEND_URL}/delete-photos`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pis: justCompleted }),
          });
          justCompleted.forEach((ip) => {
            const unit = piUnitsRef.current.find((u) => u.ipAddress === ip);
            addLog(unit?.id ?? ip, "Auto Clean", "Photos deleted after successful transfer", "success");
          });
        } catch (e) {
          addLog("System", "Auto Clean", `Failed to delete photos: ${e}`, "error");
        }
      }

      if (!silent) addLog("System", "Refresh", "Status updated successfully", "success");
    } catch (e) {
      if (!silent) addLog("System", "Refresh", `Failed to refresh: ${e}`, "error");
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    addLog("System", "Refresh", "Refreshing Pi unit statuses...", "info");
    await pollStatuses(false);
    setIsRefreshing(false);
  };

  // Auto-refresh every 3 seconds in the background
  useEffect(() => {
    const interval = setInterval(() => pollStatuses(true), 3000);
    return () => clearInterval(interval);
  }, [pollStatuses]);

  // ===== BULK ACTIONS =====
  const handleBulkAction = async (action: string) => {
    const ips = getSelectedIps();
    if (ips.length === 0) return;

    if (action === "Start Capture") {
      addLog("System", "Start Capture", `Starting capture on ${ips.length} Pi(s)…`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/start-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        });
        const data = await res.json();
        ips.forEach((ip) => {
          const unit = piUnitsRef.current.find((u) => u.ipAddress === ip);
          const label = unit?.id ?? ip;
          const r = data.results?.[ip];
          if (r?.error) addLog(label, "Start Capture", extractError(r.error), "error");
          else addLog(label, "Start Capture", "Capture started", "success");
        });
      } catch (e) {
        addLog("System", "Start Capture", extractError(e), "error");
      }
    }

    if (action === "Stop Capture") {
      addLog("System", "Stop Capture", `Stopping capture on ${ips.length} Pi(s)…`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/stop-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        });
        const data = await res.json();
        ips.forEach((ip) => {
          const unit = piUnitsRef.current.find((u) => u.ipAddress === ip);
          const label = unit?.id ?? ip;
          const r = data.results?.[ip];
          if (r?.error) addLog(label, "Stop Capture", extractError(r.error), "error");
          else addLog(label, "Stop Capture", "Capture stopped", "success");
        });
      } catch (e) {
        addLog("System", "Stop Capture", extractError(e), "error");
      }
    }

  };

  // ===== INDIVIDUAL UNIT ACTIONS =====
  const handleUnitAction = async (unitId: string, action: string) => {
    const unit = piUnits.find((u) => u.id === unitId);
    if (!unit) return;
    const ips = [unit.ipAddress];

    if (action === "Start Capture") {
      try {
        const res = await fetch(`${BACKEND_URL}/start-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        });
        const data = await res.json();
        const r = data.results?.[unit.ipAddress];
        if (r?.error) addLog(unitId, "Start Capture", extractError(r.error), "error");
        else addLog(unitId, "Start Capture", "Capture started", "success");
      } catch (e) {
        addLog(unitId, "Start Capture", extractError(e), "error");
      }
    }

    if (action === "Stop Capture") {
      try {
        const res = await fetch(`${BACKEND_URL}/stop-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        });
        const data = await res.json();
        const r = data.results?.[unit.ipAddress];
        if (r?.error) addLog(unitId, "Stop Capture", extractError(r.error), "error");
        else addLog(unitId, "Stop Capture", "Capture stopped", "success");
      } catch (e) {
        addLog(unitId, "Stop Capture", extractError(e), "error");
      }
    }

  };

  // ===== TRANSFER MODAL =====
  const openTransferModal = (target: "bulk" | string) => {
    setModalFolder("");
    setTransferModal({ target });
  };

  const executeTransfer = async (folder: string) => {
    if (!transferModal) return;
    const { target } = transferModal;
    setTransferModal(null);

    const ips = target === "bulk"
      ? getSelectedIps()
      : [piUnitsRef.current.find((u) => u.id === target)!.ipAddress];
    const label = target === "bulk" ? "System" : target;

    addLog(label, "Globus Transfer", `Initiating transfer to folder: ${folder}`, "info");
    try {
      const res = await fetch(`${BACKEND_URL}/globus-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pis: ips, foldername: folder }),
      });
      const data = await res.json();
      ips.forEach((ip) => {
        const unit = piUnitsRef.current.find((u) => u.ipAddress === ip);
        const entryLabel = unit?.id ?? ip;
        const r = data.results?.[ip];
        if (r?.error) addLog(entryLabel, "Globus Transfer", extractError(r.error), "error");
        else addLog(entryLabel, "Globus Transfer", `Transfer queued → ${folder}`, "success");
      });
    } catch (e) {
      addLog(label, "Globus Transfer", extractError(e), "error");
    }
  };

  // ===== SELECTION HANDLERS =====
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUnits(new Set(piUnits.filter((u) => u.status !== "offline" && u.status !== "connecting").map((u) => u.id)));
    } else {
      setSelectedUnits(new Set());
    }
  };

  const handleSelectUnit = (unitId: string, selected: boolean) => {
    const newSelected = new Set(selectedUnits);
    if (selected) newSelected.add(unitId);
    else newSelected.delete(unitId);
    setSelectedUnits(newSelected);
  };

  // ===== ADD / REMOVE / RENAME =====
  const handleAddPi = () => {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIpAddress)) {
      addLog("System", "Add Pi", "Invalid IP address format", "error");
      return;
    }
    if (piUnits.some((u) => u.ipAddress === newIpAddress)) {
      addLog("System", "Add Pi", `IP address ${newIpAddress} already exists`, "error");
      return;
    }
    const maxId = piUnits.reduce((max, u) => {
      const n = parseInt(u.id.split("-")[1]);
      return n > max ? n : max;
    }, 0);
    const newId = `Pi-${String(maxId + 1).padStart(2, "0")}`;
    setPiUnits([...piUnits, { id: newId, status: "connecting" as PiStatus, lastResponse: "—", lastResponseTime: "—", ipAddress: newIpAddress }]);
    addLog(newId, "Add Pi", `Added new Pi unit at ${newIpAddress}`, "success");
    setNewIpAddress("");
  };

  const handleRemovePi = (unitId: string) => {
    const unit = piUnits.find((u) => u.id === unitId);
    if (!unit) return;
    setPiUnits(piUnits.filter((u) => u.id !== unitId));
    setSelectedUnits((prev) => { const s = new Set(prev); s.delete(unitId); return s; });
    addLog(unitId, "Remove Pi", `Removed Pi unit ${unitId} (${unit.ipAddress})`, "info");
  };

  const handleRenamePi = (unitId: string, newId: string) => {
    if (piUnits.some((u) => u.id === newId && u.id !== unitId)) {
      addLog("System", "Rename Pi", `Name "${newId}" already exists`, "error");
      return;
    }
    setPiUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, id: newId } : u)));
    setSelectedUnits((prev) => { const s = new Set(prev); if (s.has(unitId)) { s.delete(unitId); s.add(newId); } return s; });
    setLogs((prev) => prev.map((l) => (l.unitId === unitId ? { ...l, unitId: newId } : l)));
    addLog(newId, "Rename Pi", `Renamed from ${unitId} to ${newId}`, "success");
  };

  const handleUpdateIp = (unitId: string, newIp: string) => {
    if (piUnits.some((u) => u.ipAddress === newIp && u.id !== unitId)) {
      addLog("System", "Update IP", `IP address ${newIp} already exists`, "error");
      return;
    }
    const updatedUnits = piUnits.map((u) => (u.id === unitId ? { ...u, ipAddress: newIp } : u));
    setPiUnits(updatedUnits);
    addLog(unitId, "Update IP", `Updated IP to ${newIp}`, "success");
    pollStatuses(true, updatedUnits.map((u) => u.ipAddress));
  };

  // ===== DRAG TO REORDER =====
  const handleDragEnd = () => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      setPiUnits((prev) => {
        const result = [...prev];
        const fromIdx = result.findIndex((u) => u.id === draggedId);
        const toIdx = result.findIndex((u) => u.id === dragOverId);
        const [moved] = result.splice(fromIdx, 1);
        result.splice(toIdx, 0, moved);
        return result;
      });
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const selectedCount = selectedUnits.size;
  const totalCount = piUnits.length;
  const selectableCount = piUnits.filter((u) => u.status !== "offline" && u.status !== "connecting").length;
  const allSelected = selectedCount === selectableCount && selectableCount > 0;
  const someSelected = selectedCount > 0 && selectedCount < selectableCount;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top Bar */}
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-red-600 flex-shrink-0">Hawkeye</h1>

          {/* Center Controls */}
          <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                className="border-gray-300 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                aria-label="Select all units"
                data-indeterminate={someSelected}
              />
              <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">Select All</span>
            </div>

            <div className="px-2 md:px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
              <span className="text-xs md:text-sm font-mono text-gray-700 whitespace-nowrap">
                {selectedCount} of {totalCount}
              </span>
            </div>

            <div className="flex gap-1 md:gap-2">
              <Button variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => handleBulkAction("Start Capture")}
                className="border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 text-[10px] md:text-sm px-2 md:px-3">
                <Play className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Start Capture</span>
                <span className="sm:hidden">Start</span>
              </Button>
              <Button variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => handleBulkAction("Stop Capture")}
                className="border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 text-[10px] md:text-sm px-2 md:px-3">
                <Square className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Stop Capture</span>
                <span className="sm:hidden">Stop</span>
              </Button>
              <Button variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => openTransferModal("bulk")}
                className="border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 text-[10px] md:text-sm px-2 md:px-3">
                <ArrowUpDown className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Globus Transfer</span>
                <span className="sm:hidden">Transfer</span>
              </Button>
              <Button variant="outline" size="sm" disabled={isRefreshing} onClick={handleRefresh}
                className="border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 text-[10px] md:text-sm px-2 md:px-3">
                <RefreshCw className={`h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <img src={ncsuLogo} alt="NC State University" className="h-16 md:h-24" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {piUnits.map((unit) => (
            <PiUnitCard
              key={unit.id}
              unit={unit}
              selected={selectedUnits.has(unit.id)}
              onSelectChange={(selected) => handleSelectUnit(unit.id, selected)}
              onStartCapture={() => handleUnitAction(unit.id, "Start Capture")}
              onStopCapture={() => handleUnitAction(unit.id, "Stop Capture")}
              onGlobusTransfer={() => openTransferModal(unit.id)}
              onRemove={() => handleRemovePi(unit.id)}
              onRename={(newId) => handleRenamePi(unit.id, newId)}
              onUpdateIp={(newIp) => handleUpdateIp(unit.id, newIp)}
              isDragging={draggedId === unit.id}
              isDragOver={dragOverId === unit.id && draggedId !== unit.id}
              onDragStart={() => setDraggedId(unit.id)}
              onDragOver={() => setDragOverId(unit.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>

        {/* Add Pi Unit */}
        <div className="mt-8">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newIpAddress}
              onChange={(e) => setNewIpAddress(e.target.value)}
              placeholder="Enter IP address"
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-600"
              onKeyDown={(e) => e.key === "Enter" && handleAddPi()}
            />
            <Button variant="outline" size="sm" onClick={handleAddPi}
              className="border-red-600 text-red-600 hover:bg-red-50 text-[10px] md:text-sm px-2 md:px-3">
              <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Add Pi Unit</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Log View */}
        <div className="mt-8">
          <LogView logs={logs} onClear={clearLogs} />
        </div>
      </main>
      {/* ── Globus Transfer Modal ── */}
      {transferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setTransferModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-base font-semibold text-gray-900">Globus Transfer</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {transferModal.target === "bulk"
                  ? `Transfer from ${selectedUnits.size} selected Pi(s)`
                  : `Transfer from ${transferModal.target}`}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Destination folder name</label>
              <input
                autoFocus
                type="text"
                value={modalFolder}
                onChange={(e) => setModalFolder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && modalFolder.trim()) executeTransfer(modalFolder.trim());
                  if (e.key === "Escape") setTransferModal(null);
                }}
                placeholder="e.g. 2024-tomato-trial-01"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setTransferModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (modalFolder.trim()) executeTransfer(modalFolder.trim()); }}
                disabled={!modalFolder.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Start Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}