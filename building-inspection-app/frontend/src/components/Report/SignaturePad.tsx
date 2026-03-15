import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  onSign: (dataUrl: string) => void;
  existingSignature?: string;
  signerName?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ label, onSign, existingSignature, signerName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    onSign(canvas.toDataURL('image/png'));
  };

  if (existingSignature) {
    return (
      <div className="border border-gray-200 rounded-lg p-3">
        <p className="text-xs font-medium text-gray-600 mb-2">{label}</p>
        <img src={existingSignature} alt="Allekirjoitus" className="h-16 object-contain" />
        {signerName && <p className="text-xs text-gray-500 mt-1">{signerName}</p>}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-600 mb-2">{label}</p>
      <canvas
        ref={canvasRef}
        className="w-full h-24 border border-dashed border-gray-300 rounded cursor-crosshair bg-white touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex gap-2 mt-2">
        <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">
          <Eraser size={12} /> Tyhjennä
        </button>
        <button onClick={confirm} disabled={!hasDrawn} className="flex items-center gap-1 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-2 py-1 rounded">
          <Check size={12} /> Hyväksy
        </button>
      </div>
    </div>
  );
};
