import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Square, ArrowUpDown, RefreshCw, Camera, ChevronDown, Eraser, Radar } from "lucide-react";
import { PiUnitCard, PiUnit, PiStatus, TransferInfo } from "./components/PiUnitCard";
import { LogView, LogEntry } from "./components/LogView";
import { Checkbox } from "./components/ui/checkbox";
import { Button } from "./components/ui/button";
import ncsuLogo from "../assets/ncsu_logo.png";

const BACKEND_URL = "http://localhost:8000";

const initialPiUnits: PiUnit[] = [];

function extractError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") {
    if (err.includes("Connection refused")) return "Connection refused";
    if (err.includes("timed out") || err.includes("Timeout") || err.includes("timeout")) return "Connection timed out";
    if (err.includes("Failed to establish") || err.includes("NewConnectionError")) return "Host unreachable";
    if (err.includes("Name or service not known") || err.includes("getaddrinfo")) return "Host not found";
    return err.length > 100 ? err.slice(0, 100) + "…" : err;
  }
  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    if (o.detail) return String(o.detail);
    if (o.message) return String(o.message);
    if (o.error) return extractError(o.error);
    const s = JSON.stringify(err);
    return s.length > 100 ? s.slice(0, 100) + "…" : s;
  }
  return String(err);
}

function getTimestamp() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
}

interface DiscoveredPi {
  hostname: string;
  ip: string;
  port: number;
}

export default function App() {
  const [piUnits, setPiUnits] = useState<PiUnit[]>(initialPiUnits);
  const piUnitsRef = useRef(piUnits);
  useEffect(() => { piUnitsRef.current = piUnits; }, [piUnits]);
  const isPollRunning = useRef(false);
  const logIdRef = useRef(0);

  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transferModal, setTransferModal] = useState<{ target: "bulk" | string } | null>(null);
  const [modalFolder, setModalFolder] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [bulkCaptureOpen, setBulkCaptureOpen] = useState(false);
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const bulkCaptureRef = useRef<HTMLDivElement>(null);
  const bulkTransferRef = useRef<HTMLDivElement>(null);

  // Discovery modal state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryModal, setDiscoveryModal] = useState(false);
  const [discoveredPis, setDiscoveredPis] = useState<DiscoveredPi[]>([]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!bulkCaptureRef.current?.contains(e.target as Node)) setBulkCaptureOpen(false);
      if (!bulkTransferRef.current?.contains(e.target as Node)) setBulkTransferOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const MAX_LOG_ENTRIES = 200;

  function addLog(unitId: string, action: string, message: string, type: "success" | "error" | "info") {
    const id = ++logIdRef.current;
    setLogs((prev) => {
      const next = [{ id, timestamp: getTimestamp(), unitId, action, message, type }, ...prev];
      return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next;
    });
  }

  function clearLogs() { setLogs([]); }

  function getSelectedHostnames(): string[] {
    return piUnits
      .filter((u) => selectedUnits.has(u.id))
      .map((u) => u.hostname);
  }

  // ===== DISCOVER PIs =====
  const handleDiscover = async () => {
    setIsDiscovering(true);
    setDiscoveredPis([]);
    setDiscoveryModal(true);
    addLog("System", "Discover", "Scanning network for Hawkeye Pis…", "info");
    try {
      const res = await fetch(`${BACKEND_URL}/discover-pis`);
      const data = await res.json();
      const found: DiscoveredPi[] = data.pis ?? [];
      setDiscoveredPis(found);
      if (found.length === 0) {
        addLog("System", "Discover", "No Pis found on network", "info");
      } else {
        addLog("System", "Discover", `Found ${found.length} Pi(s) on network`, "success");
      }
    } catch (e) {
      addLog("System", "Discover", `Discovery failed: ${extractError(e)}`, "error");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddDiscoveredPi = (discovered: DiscoveredPi) => {
    // Strip the service suffix from the name e.g. "Hawkeye-2._hawkeye._tcp.local." → "Hawkeye-2"
    const cleanName = discovered.hostname.split(".")[0];
    const hostname = `${cleanName}.local`;

    if (piUnits.some((u) => u.hostname === hostname)) {
      addLog("System", "Add Pi", `${hostname} is already in your fleet`, "error");
      return;
    }

    const maxId = piUnits.reduce((max, u) => {
      const n = parseInt(u.id.split("-")[1]);
      return isNaN(n) ? max : n > max ? n : max;
    }, 0);
    const newId = `Pi-${String(maxId + 1).padStart(2, "0")}`;

    setPiUnits((prev) => [
      ...prev,
      {
        id: newId,
        status: "connecting" as PiStatus,
        lastResponse: "—",
        lastResponseTime: "—",
        hostname,
        autoClear: false,
      },
    ]);
    addLog(newId, "Add Pi", `Added ${hostname} to fleet`, "success");
  };

  // ===== REFRESH / STATUS =====
  const pollStatuses = useCallback(async (silent = false, overrideHostnames?: string[]) => {
    if (silent && isPollRunning.current) return;
    isPollRunning.current = true;

    const currentUnits = piUnitsRef.current;
    const hostnames = overrideHostnames ?? currentUnits.map((u) => u.hostname);
    if (hostnames.length === 0) { isPollRunning.current = false; return; }

    try {
      const [captureRes, transferRes] = await Promise.all([
        fetch(`${BACKEND_URL}/capture-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: hostnames }),
        }),
        fetch(`${BACKEND_URL}/transfer-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: hostnames }),
        }),
      ]);
      const captureData = await captureRes.json();
      const transferData = await transferRes.json();

      const snapshot = piUnitsRef.current;
      const autoClearHostnames: string[] = [];

      snapshot.forEach((unit) => {
        const captureResult = captureData.results?.[unit.hostname];
        const transferResult = transferData.results?.[unit.hostname];

        if (!captureResult || captureResult.error) {
          if (unit.status !== "offline") {
            addLog(unit.id, "Connection", `Went offline — ${extractError(captureResult?.error)}`, "error");
          }
        } else {
          if (unit.status === "offline" || unit.status === "connecting") {
            addLog(unit.id, "Connection", "Back online", "success");
          }
          if (
            unit.autoClear &&
            unit.transfer?.status === "ACTIVE" &&
            transferResult?.status === "SUCCEEDED"
          ) {
            autoClearHostnames.push(unit.hostname);
          }
        }
      });

      setPiUnits((latest) =>
        latest.map((unit) => {
          const captureResult = captureData.results?.[unit.hostname];
          const transferResult = transferData.results?.[unit.hostname];

          if (!captureResult || captureResult.error) {
            return { ...unit, status: "offline" as PiStatus, transfer: null };
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

          return {
            ...unit,
            status: capturing ? ("busy" as PiStatus) : ("online" as PiStatus),
            transfer,
          };
        })
      );

      if (autoClearHostnames.length > 0) {
        try {
          await fetch(`${BACKEND_URL}/delete-photos`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pis: autoClearHostnames }),
          });
          autoClearHostnames.forEach((hostname) => {
            const unit = piUnitsRef.current.find((u) => u.hostname === hostname);
            addLog(unit?.id ?? hostname, "Auto Clear", "Photos deleted after successful transfer", "success");
          });
        } catch (e) {
          addLog("System", "Auto Clear", `Failed to delete photos: ${extractError(e)}`, "error");
        }
      }

      if (!silent) addLog("System", "Refresh", "Status updated successfully", "success");
    } catch (e) {
      if (!silent) addLog("System", "Refresh", `Failed to refresh: ${e}`, "error");
    } finally {
      isPollRunning.current = false;
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    addLog("System", "Refresh", "Refreshing Pi unit statuses...", "info");
    await pollStatuses(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    const interval = setInterval(() => pollStatuses(true), 1000);
    return () => clearInterval(interval);
  }, [pollStatuses]);

  // ===== BULK ACTIONS =====
  const handleBulkAction = async (action: string) => {
    const hostnames = getSelectedHostnames();
    if (hostnames.length === 0) return;

    if (action === "Start Capture") {
      addLog("System", "Start Capture", `Starting capture on ${hostnames.length} Pi(s)…`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/start-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: hostnames }),
        });
        const data = await res.json();
        hostnames.forEach((hostname) => {
          const unit = piUnitsRef.current.find((u) => u.hostname === hostname);
          const r = data.results?.[hostname];
          if (r?.error) addLog(unit?.id ?? hostname, "Start Capture", extractError(r.error), "error");
          else addLog(unit?.id ?? hostname, "Start Capture", "Capture started", "success");
        });
      } catch (e) {
        addLog("System", "Start Capture", extractError(e), "error");
      }
    }

    if (action === "Stop Capture") {
      addLog("System", "Stop Capture", `Stopping capture on ${hostnames.length} Pi(s)…`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/stop-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: hostnames }),
        });
        const data = await res.json();
        hostnames.forEach((hostname) => {
          const unit = piUnitsRef.current.find((u) => u.hostname === hostname);
          const r = data.results?.[hostname];
          if (r?.error) addLog(unit?.id ?? hostname, "Stop Capture", extractError(r.error), "error");
          else addLog(unit?.id ?? hostname, "Stop Capture", "Capture stopped", "success");
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

    if (action === "Start Capture") {
      try {
        const res = await fetch(`${BACKEND_URL}/start-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: [unit.hostname] }),
        });
        const data = await res.json();
        const r = data.results?.[unit.hostname];
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
          body: JSON.stringify({ pis: [unit.hostname] }),
        });
        const data = await res.json();
        const r = data.results?.[unit.hostname];
        if (r?.error) addLog(unitId, "Stop Capture", extractError(r.error), "error");
        else addLog(unitId, "Stop Capture", "Capture stopped", "success");
      } catch (e) {
        addLog(unitId, "Stop Capture", extractError(e), "error");
      }
    }
  };

  const handleToggleAutoClear = (unitId: string) => {
    setPiUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, autoClear: !u.autoClear } : u)));
  };

  const handleBulkToggleAutoClear = () => {
    setPiUnits((prev) => {
      const allOn = [...selectedUnits].every((id) => prev.find((u) => u.id === id)?.autoClear);
      return prev.map((u) => selectedUnits.has(u.id) ? { ...u, autoClear: !allOn } : u);
    });
  };

  const handleBulkClearPhotos = async () => {
    const hostnames = getSelectedHostnames();
    if (hostnames.length === 0) return;
    addLog("System", "Clear Photos", `Deleting photos on ${hostnames.length} Pi(s)…`, "info");
    try {
      const res = await fetch(`${BACKEND_URL}/delete-photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pis: hostnames }),
      });
      const data = await res.json();
      hostnames.forEach((hostname) => {
        const unit = piUnitsRef.current.find((u) => u.hostname === hostname);
        const r = data.results?.[hostname];
        if (r?.error) addLog(unit?.id ?? hostname, "Clear Photos", extractError(r.error), "error");
        else addLog(unit?.id ?? hostname, "Clear Photos", "Photos cleared successfully", "success");
      });
    } catch (e) {
      addLog("System", "Clear Photos", extractError(e), "error");
    }
  };

  const handleClearPhotos = async (unitId: string) => {
    const unit = piUnitsRef.current.find((u) => u.id === unitId);
    if (!unit) return;
    addLog(unitId, "Clear Photos", `Deleting photos on ${unitId}…`, "info");
    try {
      const res = await fetch(`${BACKEND_URL}/delete-photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pis: [unit.hostname] }),
      });
      const data = await res.json();
      const r = data.results?.[unit.hostname];
      if (r?.error) addLog(unitId, "Clear Photos", extractError(r.error), "error");
      else addLog(unitId, "Clear Photos", "Photos cleared successfully", "success");
    } catch (e) {
      addLog(unitId, "Clear Photos", extractError(e), "error");
    }
  };

  const openTransferModal = (target: "bulk" | string) => {
    setModalFolder("");
    setTransferModal({ target });
  };

  const executeTransfer = async (folder: string) => {
    if (!transferModal) return;
    const { target } = transferModal;
    setTransferModal(null);

    const targetUnit = target !== "bulk" ? piUnitsRef.current.find((u) => u.id === target) : null;
    if (target !== "bulk" && !targetUnit) {
      addLog("System", "Globus Transfer", `Pi "${target}" no longer exists`, "error");
      return;
    }
    const hostnames = target === "bulk" ? getSelectedHostnames() : [targetUnit!.hostname];
    const label = target === "bulk" ? "System" : target;

    addLog(label, "Globus Transfer", `Initiating transfer to folder: ${folder}`, "info");
    try {
      const res = await fetch(`${BACKEND_URL}/globus-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pis: hostnames, foldername: folder }),
      });
      const data = await res.json();
      hostnames.forEach((hostname) => {
        const unit = piUnitsRef.current.find((u) => u.hostname === hostname);
        const r = data.results?.[hostname];
        if (r?.error) addLog(unit?.id ?? hostname, "Globus Transfer", extractError(r.error), "error");
        else addLog(unit?.id ?? hostname, "Globus Transfer", `Transfer queued → ${folder}`, "success");
      });
    } catch (e) {
      addLog(label, "Globus Transfer", extractError(e), "error");
    }
  };

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

  const handleRemovePi = (unitId: string) => {
    const unit = piUnits.find((u) => u.id === unitId);
    if (!unit) return;
    setPiUnits(piUnits.filter((u) => u.id !== unitId));
    setSelectedUnits((prev) => { const s = new Set(prev); s.delete(unitId); return s; });
    addLog(unitId, "Remove Pi", `Removed ${unitId} (${unit.hostname})`, "info");
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

  const handleUpdateHostname = (unitId: string, newHostname: string) => {
    if (piUnits.some((u) => u.hostname === newHostname && u.id !== unitId)) {
      addLog(unitId, "Update Hostname", `Hostname ${newHostname} already in use`, "error");
      return;
    }
    const updatedUnits = piUnits.map((u) => (u.id === unitId ? { ...u, hostname: newHostname } : u));
    setPiUnits(updatedUnits);
    addLog(unitId, "Update Hostname", `Updated hostname to ${newHostname}`, "success");
    pollStatuses(true, updatedUnits.map((u) => u.hostname));
  };

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

  // Hostnames already in fleet (for filtering discovery results)
  const fleetHostnames = new Set(piUnits.map((u) => u.hostname));

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

            {/* Bulk Capture Dropdown */}
            <div className="relative" ref={bulkCaptureRef}>
              <button
                disabled={selectedCount === 0}
                onClick={() => { setBulkCaptureOpen((o) => !o); setBulkTransferOpen(false); }}
                className="flex items-center gap-1.5 text-[10px] md:text-sm px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Camera className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Capture</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${bulkCaptureOpen ? "rotate-180" : ""}`} />
              </button>
              {bulkCaptureOpen && (
                <div className="absolute top-full mt-1 left-0 z-30 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-44">
                  <button
                    onClick={() => { setBulkCaptureOpen(false); handleBulkAction("Start Capture"); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    Start Capture
                  </button>
                  <button
                    onClick={() => { setBulkCaptureOpen(false); handleBulkAction("Stop Capture"); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Square className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    Stop Capture
                  </button>
                </div>
              )}
            </div>

            {/* Bulk Transfer Dropdown */}
            <div className="relative" ref={bulkTransferRef}>
              <button
                disabled={selectedCount === 0}
                onClick={() => { setBulkTransferOpen((o) => !o); setBulkCaptureOpen(false); }}
                className="flex items-center gap-1.5 text-[10px] md:text-sm px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowUpDown className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Transfer</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${bulkTransferOpen ? "rotate-180" : ""}`} />
              </button>
              {bulkTransferOpen && (() => {
                const selectedIds = [...selectedUnits];
                const activeCount = selectedIds.filter((id) => piUnits.find((u) => u.id === id)?.transfer?.status === "ACTIVE").length;
                const allAutoClear = selectedIds.length > 0 && selectedIds.every((id) => piUnits.find((u) => u.id === id)?.autoClear);
                const someAutoClear = selectedIds.some((id) => piUnits.find((u) => u.id === id)?.autoClear);
                return (
                  <div className="absolute top-full mt-1 left-0 z-30 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-52">
                    <button
                      onClick={() => { setBulkTransferOpen(false); openTransferModal("bulk"); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      Begin Transfer
                    </button>
                    <button
                      onClick={() => { if (activeCount === 0) { setBulkTransferOpen(false); handleBulkClearPhotos(); } }}
                      disabled={activeCount > 0}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Eraser className="h-3.5 w-3.5 flex-shrink-0" />
                      Clear Photos
                    </button>
                    <div
                      className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={handleBulkToggleAutoClear}
                    >
                      <input
                        type="checkbox"
                        checked={allAutoClear}
                        ref={(el) => { if (el) el.indeterminate = !allAutoClear && someAutoClear; }}
                        onChange={() => {}}
                        className="h-3.5 w-3.5 accent-red-600 pointer-events-none"
                      />
                      <span className="text-sm text-gray-600 select-none leading-tight">Auto-clear after upload</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <Button variant="outline" size="sm" disabled={isRefreshing} onClick={handleRefresh}
              className="border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 text-[10px] md:text-sm px-2 md:px-3">
              <RefreshCw className={`h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>

          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <img src={ncsuLogo} alt="NC State University" className="h-16 md:h-20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Empty state */}
        {piUnits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Radar className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">No Pis in your fleet</h2>
            <p className="text-sm text-gray-500 mb-6">Discover Pis on your network or add one manually.</p>
            <Button onClick={handleDiscover} disabled={isDiscovering}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-sm">
              <Radar className={`h-4 w-4 mr-2 ${isDiscovering ? "animate-spin" : ""}`} />
              {isDiscovering ? "Scanning…" : "Discover Pis"}
            </Button>
          </div>
        )}

        {piUnits.length > 0 && (
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
                onClearPhotos={() => handleClearPhotos(unit.id)}
                onToggleAutoClear={() => handleToggleAutoClear(unit.id)}
                onRemove={() => handleRemovePi(unit.id)}
                onRename={(newId) => handleRenamePi(unit.id, newId)}
                onUpdateHostname={(newHostname) => handleUpdateHostname(unit.id, newHostname)}
                isDragging={draggedId === unit.id}
                isDragOver={dragOverId === unit.id && draggedId !== unit.id}
                onDragStart={() => setDraggedId(unit.id)}
                onDragOver={() => { if (dragOverId !== unit.id) setDragOverId(unit.id); }}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}

        {/* Discover button (when fleet is non-empty) */}
        {piUnits.length > 0 && (
          <div className="mt-8 flex items-center gap-3">
            <Button
              onClick={handleDiscover}
              disabled={isDiscovering}
              variant="outline"
              size="sm"
              className="border-red-600 text-red-600 hover:bg-red-50 text-sm px-3 py-2"
            >
              <Radar className={`h-4 w-4 mr-1.5 ${isDiscovering ? "animate-spin" : ""}`} />
              {isDiscovering ? "Scanning…" : "Discover Pis"}
            </Button>
          </div>
        )}

        {/* Log View */}
        <div className="mt-8">
          <LogView logs={logs} onClear={clearLogs} />
        </div>
      </main>

      {/* ── Discovery Modal ── */}
      {discoveryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { if (!isDiscovering) setDiscoveryModal(false); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Discover Pis</h2>
                <p className="text-sm text-gray-500 mt-0.5">Hawkeye devices found on your network</p>
              </div>
              {isDiscovering && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <Radar className="h-4 w-4 animate-spin" />
                  <span>Scanning…</span>
                </div>
              )}
            </div>

            {/* Results */}
            <div className="flex flex-col gap-2 min-h-[80px]">
              {isDiscovering && discoveredPis.length === 0 && (
                <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                  Scanning network…
                </div>
              )}
              {!isDiscovering && discoveredPis.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-gray-500 text-sm">No Pis found on the network.</p>
                  <p className="text-gray-400 text-xs mt-1">Make sure your Pis are powered on and connected.</p>
                </div>
              )}
              {discoveredPis.map((pi) => {
                const cleanName = pi.hostname.split(".")[0];
                const hostname = `${cleanName}.local`;
                const alreadyAdded = fleetHostnames.has(hostname);
                return (
                  <div
                    key={pi.hostname}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-mono font-medium text-gray-900">{hostname}</p>
                      <p className="text-xs text-gray-400">{pi.ip} · port {pi.port}</p>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-xs text-emerald-600 font-medium px-2 py-1 bg-emerald-50 rounded-full border border-emerald-200">
                        In fleet
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddDiscoveredPi(pi)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <button
                onClick={handleDiscover}
                disabled={isDiscovering}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                {isDiscovering ? "Scanning…" : "Scan again"}
              </button>
              <button
                onClick={() => setDiscoveryModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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