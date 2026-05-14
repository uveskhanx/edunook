const fs = require('fs');
const file = 'src/app/chat/chat-client.tsx';
let c = fs.readFileSync(file, 'utf8');

// Insert camera functions right before handleSendMessage
const cameraFunctions = `
  const captureFrame = useCallback((): string | null => {
    const video = cameraVideoRef.current;
    if (!video || !cameraActive || video.readyState < 2) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return null;
    }
  }, [cameraActive]);

  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user') => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setCameraFacing(facing);
    } catch (err) {
      console.error('Camera access failed:', err);
      toast.error('Camera access was denied. Please allow camera access in your browser settings.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const toggleCamera = useCallback(() => {
    if (cameraActive) { stopCamera(); } else { startCamera(cameraFacing); }
  }, [cameraActive, cameraFacing, startCamera, stopCamera]);

  const flipCamera = useCallback(() => {
    const next = cameraFacing === 'user' ? 'environment' : 'user';
    startCamera(next);
  }, [cameraFacing, startCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

`;

const handleSendAnchor = "  const handleSendMessage = async (text: string, media";
c = c.replace(handleSendAnchor, cameraFunctions + handleSendAnchor);

// Now modify handleSendMessage to capture a frame and send it
// Find the setAiLoadingState line and inject liveFrame capture right before the fetch
c = c.replace(
  "        setAiLoadingState(state);",
  "        const liveFrame = captureFrame();\n        if (liveFrame) state = 'Seeing you...';\n        setAiLoadingState(state);"
);

// Add liveFrame to the JSON body
c = c.replace(
  "            location: currentLocation\r\n          })",
  "            location: currentLocation,\n            liveFrame\n          })"
);

// Also handle LF only variant
c = c.replace(
  "            location: currentLocation\n          })",
  "            location: currentLocation,\n            liveFrame\n          })"
);

fs.writeFileSync(file, c);
console.log('Step 2 done');
