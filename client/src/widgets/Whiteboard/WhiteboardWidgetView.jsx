import React, { useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export default function WhiteboardWidgetView({ config = {} }) {
  const {
    brushColor = '#6366f1',
    brushSize = 4,
    backgroundColor = '#0f172a',
    borderRadius = '12px',
    customCSS = '',
  } = config;

  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(brushColor);
  const [size, setSize] = useState(brushSize);
  const [lastPoint, setLastPoint] = useState(null);

  const safeCSS = customCSS ? customCSS.replace(/<\/style>/gi, '') : '';

  // Parse widget ID
  const renderMatch = window.location.pathname.match(/\/widget\/render\/([^/]+)/);
  const editMatch = window.location.pathname.match(/\/edit\/([^/]+)/);
  const widgetId = renderMatch ? renderMatch[1] : (editMatch ? editMatch[1] : null);

  useEffect(() => {
    setColor(brushColor);
    setSize(brushSize);
  }, [brushColor, brushSize]);

  // Canvas drawing assistant
  const drawLineOnCanvas = (from, to, lineColor, lineSize) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  // Connect WebSockets
  useEffect(() => {
    if (!widgetId) return;

    const socket = io('/', { transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('join-widget', widgetId);

    socket.on('line-drawn', ({ from, to, color: c, size: s }) => {
      drawLineOnCanvas(from, to, c, s);
    });

    socket.on('whiteboard-cleared', () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [widgetId]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    // Support mouse and mobile touch points
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    setLastPoint(coords);
  };

  const draw = (e) => {
    if (!isDrawing || !lastPoint) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    drawLineOnCanvas(lastPoint, coords, color, size);

    if (socketRef.current && widgetId) {
      socketRef.current.emit('draw-line', {
        widgetId,
        from: lastPoint,
        to: coords,
        color,
        size,
      });
    }

    setLastPoint(coords);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (socketRef.current && widgetId) {
      socketRef.current.emit('clear-whiteboard', { widgetId });
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'whiteboard-drawing.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <>
      {safeCSS ? <style>{safeCSS}</style> : null}
      <div
        style={{
          width: '100%',
          height: '100vh',
          background: backgroundColor,
          borderRadius,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxSizing: 'border-box',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '28px',
                height: '28px',
                border: 'none',
                cursor: 'pointer',
                background: 'none',
              }}
            />
            <input
              type="range"
              min="1"
              max="20"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              style={{ width: '80px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={downloadCanvas}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: '#6366f1',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              Download
            </button>
            <button
              onClick={clearCanvas}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            width: '100%',
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            cursor: 'crosshair',
          }}
        />
      </div>
    </>
  );
}
