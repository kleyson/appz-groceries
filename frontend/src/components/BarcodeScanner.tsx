import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Camera, Loader2, SwitchCamera, Flashlight } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { lookupBarcodeParallel, type ProductInfo } from "@/lib/barcode-lookup";
import { cn } from "@/lib/utils";

interface CameraDevice {
  id: string;
  label: string;
}

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
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get available cameras on mount
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          // Prefer back cameras, sort by label to get main camera first
          const sortedDevices = devices
            .filter(
              (d) =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("rear") ||
                d.label.toLowerCase().includes("environment") ||
                !d.label.toLowerCase().includes("front"),
            )
            .sort((a, b) => {
              // Prefer "main" or "wide" cameras over "ultra" or "telephoto"
              const aScore = getCameraScore(a.label);
              const bScore = getCameraScore(b.label);
              return bScore - aScore;
            });

          const cameraList = sortedDevices.length > 0 ? sortedDevices : devices;
          setCameras(cameraList.map((d) => ({ id: d.id, label: d.label })));
        }
      })
      .catch(console.error);
  }, []);

  // Score cameras to prefer main/wide over ultra-wide/telephoto
  const getCameraScore = (label: string): number => {
    const lower = label.toLowerCase();
    if (lower.includes("main") || lower.includes("wide angle")) return 100;
    if (lower.includes("wide") && !lower.includes("ultra")) return 90;
    if (lower.includes("back") || lower.includes("rear")) return 80;
    if (lower.includes("ultra")) return 30; // Ultra-wide is bad for barcodes
    if (lower.includes("tele") || lower.includes("zoom")) return 40;
    return 50;
  };

  const stopScanner = useCallback(async () => {
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
    setTorchEnabled(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current || cameras.length === 0) return;

    setError(null);
    setIsScanning(true);
    setTorchSupported(false);

    try {
      const scanner = new Html5Qrcode("barcode-scanner", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;

      const cameraId = cameras[currentCameraIndex]?.id;

      await scanner.start(
        cameraId || { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.5,
          // Request higher resolution for better scanning
          videoConstraints: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
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

      // Check if torch is supported via running track
      try {
        const settings = scanner.getRunningTrackSettings() as Record<
          string,
          unknown
        >;
        if (settings?.torch !== undefined) {
          setTorchSupported(true);
        }
      } catch {
        // Torch not supported
      }

      // Apply advanced constraints for better focus
      try {
        const videoElement = document.querySelector(
          "#barcode-scanner video",
        ) as HTMLVideoElement;
        if (videoElement?.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          const track = stream.getVideoTracks()[0];
          if (!track) throw new Error("No video track");

          const capabilities = track.getCapabilities?.() as
            | Record<string, unknown>
            | undefined;

          if (capabilities) {
            const constraints: Record<string, unknown> = {};
            const focusModes = capabilities.focusMode as string[] | undefined;
            const exposureModes = capabilities.exposureMode as
              | string[]
              | undefined;

            if (focusModes?.includes("continuous")) {
              constraints.focusMode = "continuous";
            }

            if (exposureModes?.includes("continuous")) {
              constraints.exposureMode = "continuous";
            }

            if (capabilities.torch) {
              setTorchSupported(true);
            }

            if (Object.keys(constraints).length > 0) {
              await track.applyConstraints(
                constraints as MediaTrackConstraints,
              );
            }
          }
        }
      } catch (err) {
        console.warn("Could not apply advanced camera constraints:", err);
      }
    } catch (err) {
      console.error("Scanner error:", err);
      setError(
        "Failed to start camera. Please ensure camera permissions are granted.",
      );
      setIsScanning(false);
    }
  }, [
    cameras,
    currentCameraIndex,
    lastScannedCode,
    onClose,
    onProductFound,
    stopScanner,
  ]);

  // Start scanner when modal opens and cameras are available
  useEffect(() => {
    if (isOpen && cameras.length > 0 && !isScanning) {
      startScanner();
    }

    return () => {
      if (!isOpen) {
        stopScanner();
      }
    };
  }, [isOpen, cameras.length, startScanner, stopScanner, isScanning]);

  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;

    await stopScanner();
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    // Scanner will restart via useEffect
  };

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;

    try {
      const videoElement = document.querySelector(
        "#barcode-scanner video",
      ) as HTMLVideoElement;
      if (videoElement?.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (!track) return;

        await track.applyConstraints({
          advanced: [{ torch: !torchEnabled } as MediaTrackConstraintSet],
        });
        setTorchEnabled(!torchEnabled);
      }
    } catch (err) {
      console.warn("Could not toggle torch:", err);
    }
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

          {/* Camera controls */}
          {isScanning && (
            <div className="absolute top-2 right-2 flex gap-2">
              {cameras.length > 1 && (
                <button
                  onClick={handleSwitchCamera}
                  className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors touch-target flex items-center justify-center"
                  aria-label="Switch camera"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
              )}
              {torchSupported && (
                <button
                  onClick={handleToggleTorch}
                  className={cn(
                    "p-2 rounded-full transition-colors touch-target flex items-center justify-center",
                    torchEnabled
                      ? "bg-amber-500 text-white"
                      : "bg-black/50 text-white hover:bg-black/70",
                  )}
                  aria-label={torchEnabled ? "Turn off flash" : "Turn on flash"}
                >
                  <Flashlight className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Current camera indicator */}
          {isScanning && cameras.length > 1 && (
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/50 text-white text-xs">
              {cameras[currentCameraIndex]?.label ||
                `Camera ${currentCameraIndex + 1}`}
            </div>
          )}

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
          {cameras.length > 1 && " • Tap camera icon to switch"}
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
