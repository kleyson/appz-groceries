import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, Loader2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { lookupBarcodeParallel, type ProductInfo } from "@/lib/barcode-lookup";
import { cn } from "@/lib/utils";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onProductFound: (product: ProductInfo, barcode: string) => void;
}

export function BarcodeScanner({
  isOpen,
  onClose,
  onProductFound,
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isScanning) {
      startScanner();
    }

    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startScanner = async () => {
    if (!containerRef.current) return;

    setError(null);
    setIsScanning(true);

    try {
      const scanner = new Html5Qrcode("barcode-scanner");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        async (decodedText) => {
          // Avoid duplicate scans
          if (decodedText === lastScannedCode) return;
          setLastScannedCode(decodedText);

          // Pause scanning while looking up
          await scanner.pause(true);
          setIsLookingUp(true);

          try {
            const product = await lookupBarcodeParallel(decodedText);
            if (product) {
              onProductFound(product, decodedText);
              stopScanner();
              onClose();
            } else {
              setError(`Product not found for barcode: ${decodedText}`);
              // Resume scanning after a delay
              setTimeout(() => {
                setLastScannedCode(null);
                scanner.resume();
              }, 2000);
            }
          } catch (err) {
            console.error("Lookup error:", err);
            setError("Failed to look up product");
            setTimeout(() => {
              setLastScannedCode(null);
              scanner.resume();
            }, 2000);
          } finally {
            setIsLookingUp(false);
          }
        },
        () => {
          // Ignore scan errors (no barcode detected)
        },
      );
    } catch (err) {
      console.error("Scanner error:", err);
      setError(
        "Failed to start camera. Please ensure camera permissions are granted.",
      );
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setLastScannedCode(null);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Scan Barcode">
      <div className="space-y-4">
        {/* Scanner viewport */}
        <div
          ref={containerRef}
          className="relative bg-slate-900 rounded-lg overflow-hidden"
          style={{ minHeight: "300px" }}
        >
          <div id="barcode-scanner" className="w-full" />

          {/* Overlay when looking up */}
          {isLookingUp && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Looking up product...</p>
              </div>
            </div>
          )}

          {/* Camera icon when not scanning */}
          {!isScanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <Camera className="w-16 h-16 text-slate-500" />
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div
            className={cn(
              "p-3 rounded-lg text-sm",
              error.includes("not found")
                ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200",
            )}
          >
            {error}
          </div>
        )}

        {/* Instructions */}
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Point your camera at a barcode to scan it
        </p>

        {/* Close button */}
        <Button variant="secondary" className="w-full" onClick={handleClose}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
