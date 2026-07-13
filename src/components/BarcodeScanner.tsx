import { useState, useRef, useEffect } from 'react';
import { Camera, X, Search, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

const BarcodeScanner = ({ isOpen, onClose, onScan }: BarcodeScannerProps) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanCooldownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && hasPermission === null) {
      setHasScanned(false);
      setLastScannedCode('');
      requestCameraPermission();
    }

    return () => {
      stopCamera();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (scanCooldownRef.current) {
        clearTimeout(scanCooldownRef.current);
      }
    };
  }, [isOpen]);

  const requestCameraPermission = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');
      setCameraDevices(videoDevices);

      let constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (backCameraError) {
        constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      setHasPermission(true);
      setError('');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        videoRef.current.onloadeddata = () => {
          videoRef.current
            ?.play()
            .then(() => {
              setTimeout(() => startBarcodeScanning(), 1000);
            })
            .catch((err) => {
              console.error('Error playing video:', err);
              setError('مقدرناش نشغل الكاميرا');
            });
        };

        videoRef.current.onerror = (err) => {
          console.error('Video element error:', err);
          setError('حصلت مشكلة في تشغيل الكاميرا');
        };
      }
    } catch (err) {
      console.error('Camera permission denied or error:', err);
      setHasPermission(false);
      setError('لازم تسمح للكاميرا علشان نقدر نقرأ الباركود. اسمح ليها وحاول تاني.');
    }
  };

  const startBarcodeScanning = () => {
    if (!videoRef.current || !streamRef.current || hasScanned) {
      return;
    }

    codeReaderRef.current = new BrowserMultiFormatReader();
    setIsScanning(true);

    try {
      codeReaderRef.current.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result && !hasScanned) {
          const scannedCode = result.getText();

          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }

          if (scannedCode === lastScannedCode) {
            return;
          }

          setHasScanned(true);
          setLastScannedCode(scannedCode);

          debounceTimeoutRef.current = setTimeout(() => {
            onScan(scannedCode);
            setTimeout(() => handleClose(), 100);
          }, 300);
        }
        if (err && !(err instanceof NotFoundException)) {
          console.error('Barcode scanning error:', err);
        }
      });
    } catch (scanError) {
      console.error('Failed to start barcode scanning:', scanError);
      setError('فشل بدء قراءة الباركود');
    }
  };

  const stopCamera = () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (scanCooldownRef.current) {
      clearTimeout(scanCooldownRef.current);
      scanCooldownRef.current = null;
    }
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (err) {
        console.error('Error resetting code reader:', err);
      }
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setHasScanned(false);
    setLastScannedCode('');
  };

  const handleClose = () => {
    stopCamera();
    setHasPermission(null);
    setError('');
    setHasScanned(false);
    setLastScannedCode('');
    onClose();
  };

  const simulateBarcodeScan = () => {
    if (hasScanned) return;
    const demoBarcode = '1234567890123';
    setHasScanned(true);
    setLastScannedCode(demoBarcode);
    onScan(demoBarcode);
    setTimeout(() => handleClose(), 100);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            قارئ الباركود
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {hasPermission === null && (
            <div className="text-center py-8">
              <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">بنطلب صلاحية استخدام الكاميرا...</p>
            </div>
          )}

          {hasPermission === false && (
            <div className="text-center py-8">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <X className="h-8 w-8 mx-auto text-red-500 mb-2" />
                <p className="text-red-700 text-sm">{error}</p>
                <Button onClick={requestCameraPermission} className="mt-4" size="sm">
                  حاول تاني
                </Button>
              </div>
            </div>
          )}

          {hasPermission === true && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white w-48 h-24 rounded-lg opacity-80">
                    <div className="w-full h-full border-2 border-green-400 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                {isScanning && !hasScanned && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                    جاري القراءة...
                  </div>
                )}
                {hasScanned && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                    اتقرا!
                  </div>
                )}
                {error && (
                  <div className="absolute bottom-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                    {error}
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  حط الباركود جوه الإطار
                </p>

                <div className="space-y-2">
                  <Button
                    onClick={simulateBarcodeScan}
                    variant="outline"
                    className="w-full"
                    disabled={hasScanned}
                  >
                    <Search className="h-4 w-4 ml-2" />
                    باركود تجريبي (بديل)
                  </Button>

                  <Button
                    onClick={requestCameraPermission}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={hasScanned}
                  >
                    <Camera className="h-4 w-4 ml-2" />
                    إعادة تشغيل الكاميرا
                  </Button>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  في مشكلة؟ جرب الباركود التجريبي أو إعادة تشغيل الكاميرا.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
