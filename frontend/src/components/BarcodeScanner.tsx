import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  X,
  Camera,
  Loader2,
  SwitchCamera,
  Flashlight,
  Focus,
} from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { lookupBarcodeParallel, type ProductInfo } from "@/lib/barcode-lookup";
import { cn } from "@/lib/utils";

interface CameraDevice {
  id: string;
  label: string;
}

interface FocusPoint {
  x: number;
  y: number;
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
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [focusSupported, setFocusSupported] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSwitchingCamera = useRef(false);
  const focusTimeoutRef = useRef<number | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCameras([]);
      setCurrentCameraIndex(0);
      setError(null);
      setLastScannedCode(null);
      setTorchEnabled(false);
      setTorchSupported(false);
      setFocusPoint(null);
      setFocusSupported(false);
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    }
  }, [isOpen]);

  // Get available cameras only when modal opens
  useEffect(() => {
    if (!isOpen) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          // Store all cameras for switching, but we'll use facingMode for initial selection
          setCameras(devices.map((d) => ({ id: d.id, label: d.label })));
        }
      })
      .catch((err) => {
        console.error("Failed to get cameras:", err);
        // Still allow scanning with facingMode fallback
        setCameras([{ id: "environment", label: "Back Camera" }]);
      });
  }, [isOpen]);

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

  const startScanner = useCallback(
    async (cameraIndex: number) => {
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

        // Use facingMode: "environment" for initial back camera, or specific camera ID when switching
        const cameraConfig =
          cameraIndex === 0 && cameras[0]?.id === "environment"
            ? { facingMode: "environment" as const }
            : cameras[cameraIndex]?.id || {
                facingMode: "environment" as const,
              };

        await scanner.start(
          cameraConfig,
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

              // Check if manual focus is supported for tap-to-focus
              if (
                focusModes?.includes("manual") ||
                focusModes?.includes("single-shot")
              ) {
                setFocusSupported(true);
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
    },
    [cameras, lastScannedCode, onClose, onProductFound, stopScanner],
  );

  // Start scanner when modal opens and cameras are available
  useEffect(() => {
    if (
      isOpen &&
      cameras.length > 0 &&
      !isScanning &&
      !isSwitchingCamera.current
    ) {
      startScanner(currentCameraIndex);
    }
  }, [isOpen, cameras.length, currentCameraIndex, startScanner, isScanning]);

  // Clean up when modal closes
  useEffect(() => {
    return () => {
      if (!isOpen) {
        stopScanner();
      }
    };
  }, [isOpen, stopScanner]);

  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;

    isSwitchingCamera.current = true;
    await stopScanner();
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);

    // Start scanner with new camera
    setTimeout(async () => {
      await startScanner(nextIndex);
      isSwitchingCamera.current = false;
    }, 100);
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

  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isScanning || !focusSupported) return;

    const videoElement = document.querySelector(
      "#barcode-scanner video",
    ) as HTMLVideoElement;
    if (!videoElement?.srcObject) return;

    // Calculate tap position relative to video
    const rect = videoElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Show focus indicator
    setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    // Clear previous timeout
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    // Hide focus indicator after animation
    focusTimeoutRef.current = window.setTimeout(() => {
      setFocusPoint(null);
    }, 1000);

    try {
      const stream = videoElement.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      // Apply focus at the tapped point
      await track.applyConstraints({
        advanced: [
          {
            focusMode: "manual",
            pointsOfInterest: [{ x, y }],
          } as MediaTrackConstraintSet,
        ],
      });

      // After focusing, switch back to continuous for ongoing scanning
      setTimeout(async () => {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          });
        } catch {
          // Ignore - continuous might not be supported
        }
      }, 500);
    } catch (err) {
      console.warn("Could not apply tap-to-focus:", err);
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
          className="relative bg-slate-900 rounded-lg overflow-hidden cursor-pointer"
          style={{ minHeight: "300px" }}
          onClick={handleTapToFocus}
        >
          <div id="barcode-scanner" className="w-full" />

          {/* Tap-to-focus indicator */}
          {focusPoint && (
            <div
              className="absolute pointer-events-none animate-pulse"
              style={{
                left: focusPoint.x - 24,
                top: focusPoint.y - 24,
              }}
            >
              <Focus className="w-12 h-12 text-white drop-shadow-lg" />
            </div>
          )}

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
          {focusSupported && " • Tap to focus"}
          {cameras.length > 1 && " • Tap icon to switch camera"}
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
