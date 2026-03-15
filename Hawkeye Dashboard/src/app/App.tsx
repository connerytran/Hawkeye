import { useState, useEffect, useCallback } from "react";
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
    status: "online" as PiStatus,
    lastResponse: "200 OK",
    lastResponseTime: "3s ago",
    ipAddress: "192.168.2.97",
  },
];

function getTimestamp() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
}

export default function App() {
  const [piUnits, setPiUnits] = useState<PiUnit[]>(initialPiUnits);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState("");
  const [foldername, setFoldername] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  function addLog(unitId: string, action: string, message: string, type: "success" | "error" | "info") {
    setLogs((prev) => [{ timestamp: getTimestamp(), unitId, action, message, type }, ...prev]);
  }

  function getSelectedIps(): string[] {
    return piUnits
      .filter((u) => selectedUnits.has(u.id))
      .map((u) => u.ipAddress);
  }

  // ===== REFRESH / STATUS =====
  const pollStatuses = useCallback(async (silent = false, overrideIps?: string[]) => {
    const ips = overrideIps ?? piUnits.map((u) => u.ipAddress);
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

      setPiUnits((prev) =>
        prev.map((unit) => {
          const captureResult = captureData.results?.[unit.ipAddress];
          const transferResult = transferData.results?.[unit.ipAddress];

          if (!captureResult || captureResult.error) {
            return { ...unit, status: "offline" as PiStatus, lastResponse: "Error", lastResponseTime: "just now", transfer: null };
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
            lastResponse: captureResult.capture_status,
            lastResponseTime: "just now",
            transfer,
          };
        })
      );
      if (!silent) addLog("System", "Refresh", "Status updated successfully", "success");
    } catch (e) {
      if (!silent) addLog("System", "Refresh", `Failed to refresh: ${e}`, "error");
    }
  }, [piUnits]);

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
      addLog("System", "Start Capture", `Starting capture on ${ips.length} Pi(s)...`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/start-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        });
        const data = await res.json();
        addLog("System", "Start Capture", `Status: ${data.status}`, data.status === "success" ? "success" : "error");
      } catch (e) {
        addLog("System", "Start Capture", `Failed: ${e}`, "error");
      }
    }

    if (action === "Stop Capture") {
      addLog("System", "Stop Capture", `Stopping capture on ${ips.length} Pi(s)...`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/stop-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        });
        const data = await res.json();
        addLog("System", "Stop Capture", `Status: ${data.status}`, data.status === "success" ? "success" : "error");
      } catch (e) {
        addLog("System", "Stop Capture", `Failed: ${e}`, "error");
      }
    }

    if (action === "Globus Transfer") {
      if (!foldername.trim()) {
        addLog("System", "Globus Transfer", "Please enter a folder name before transferring", "error");
        return;
      }
      addLog("System", "Globus Transfer", `Initiating transfer to folder: ${foldername}`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/globus-transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips, foldername }),
        });
        const data = await res.json();
        addLog("System", "Globus Transfer", `Status: ${data.status}`, data.status === "success" ? "success" : "error");
      } catch (e) {
        addLog("System", "Globus Transfer", `Failed: ${e}`, "error");
      }
    }
  };

  // ===== INDIVIDUAL UNIT ACTIONS =====
  const handleUnitAction = async (unitId: string, action: string) => {
    const unit = piUnits.find((u) => u.id === unitId);
    if (!unit) return;
    const ips = [unit.ipAddress];

    if (action === "Start Capture") {
      addLog(unitId, "Start Capture", `Starting capture on ${unitId}...`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/start-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        });
        const data = await res.json();
        addLog(unitId, "Start Capture", `Status: ${data.status}`, data.status === "success" ? "success" : "error");
      } catch (e) {
        addLog(unitId, "Start Capture", `Failed: ${e}`, "error");
      }
    }

    if (action === "Stop Capture") {
      addLog(unitId, "Stop Capture", `Stopping capture on ${unitId}...`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/stop-capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips }),
        });
        const data = await res.json();
        addLog(unitId, "Stop Capture", `Status: ${data.status}`, data.status === "success" ? "success" : "error");
      } catch (e) {
        addLog(unitId, "Stop Capture", `Failed: ${e}`, "error");
      }
    }

    if (action === "Globus Transfer") {
      if (!foldername.trim()) {
        addLog(unitId, "Globus Transfer", "Please enter a folder name before transferring", "error");
        return;
      }
      addLog(unitId, "Globus Transfer", `Initiating transfer for ${unitId} to folder: ${foldername}`, "info");
      try {
        const res = await fetch(`${BACKEND_URL}/globus-transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pis: ips, foldername }),
        });
        const data = await res.json();
        addLog(unitId, "Globus Transfer", `Status: ${data.status}`, data.status === "success" ? "success" : "error");
      } catch (e) {
        addLog(unitId, "Globus Transfer", `Failed: ${e}`, "error");
      }
    }
  };

  // ===== SELECTION HANDLERS =====
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUnits(new Set(piUnits.filter((u) => u.status !== "offline").map((u) => u.id)));
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
    setPiUnits([...piUnits, { id: newId, status: "online" as PiStatus, lastResponse: "200 OK", lastResponseTime: "just now", ipAddress: newIpAddress }]);
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

  const selectedCount = selectedUnits.size;
  const totalCount = piUnits.length;
  const selectableCount = piUnits.filter((u) => u.status !== "offline").length;
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

            {/* Folder name input for Globus Transfer */}
            <input
              type="text"
              value={foldername}
              onChange={(e) => setFoldername(e.target.value)}
              placeholder="Folder name for transfer"
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-red-600 w-44"
            />

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
              <Button variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => handleBulkAction("Globus Transfer")}
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
              onGlobusTransfer={() => handleUnitAction(unit.id, "Globus Transfer")}
              onRemove={() => handleRemovePi(unit.id)}
              onRename={(newId) => handleRenamePi(unit.id, newId)}
              onUpdateIp={(newIp) => handleUpdateIp(unit.id, newIp)}
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
          <LogView logs={logs} />
        </div>
      </main>
    </div>
  );
}