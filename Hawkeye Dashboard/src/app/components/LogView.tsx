import { ScrollArea } from "./ui/scroll-area";

export interface LogEntry {
  timestamp: string;
  unitId: string;
  action: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface LogViewProps {
  logs: LogEntry[];
}

const logTypeConfig = {
  info: "text-blue-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-red-600",
};

export function LogView({ logs }: LogViewProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
      </div>
      <ScrollArea className="h-64">
        <div className="p-4 space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No activity logged yet
            </p>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-4 text-sm font-mono py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-500 min-w-[80px]">
                  {log.timestamp}
                </span>
                <span className="font-bold text-gray-900 min-w-[60px]">
                  {log.unitId}
                </span>
                <span className="text-gray-600 min-w-[120px]">
                  {log.action}
                </span>
                <span className={logTypeConfig[log.type]}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
