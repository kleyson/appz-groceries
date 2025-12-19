import { X, Download, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/Button";

export function InstallPrompt() {
  const { canInstall, install, dismiss } = usePWAInstall();

  if (!canInstall) {
    return null;
  }

  return (
    <div className="fixed bottom-0 inset-x-0 p-4 z-50 animate-slide-up">
      <div className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Install Groceries
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Add to your home screen for quick access and offline use.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={dismiss}
            className="flex-1"
          >
            Not now
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={install}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-1" />
            Install
          </Button>
        </div>
      </div>
    </div>
  );
}
