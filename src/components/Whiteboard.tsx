
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Minus, Plus, Trash2, Palette, Brush as BrushIcon } from 'lucide-react'; // Palette for color picker idea

const colors = [
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Green', value: '#008000' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'White (Eraser)', value: '#FFFFFF' }, // For eraser on non-transparent bg
];

const lineSizes = [
  { name: 'Small', value: 2 },
  { name: 'Medium', value: 5 },
  { name: 'Large', value: 10 },
  { name: 'X-Large', value: 20 },
];

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  const [currentColor, setCurrentColor] = useState<string>(colors[0].value);
  const [currentLineWidth, setCurrentLineWidth] = useState<number>(lineSizes[1].value);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');

  const [canvasWidth, setCanvasWidth] = useState(800); // Default, will be updated
  const [canvasHeight, setCanvasHeight] = useState(600); // Default, will be updated
  const containerRef = useRef<HTMLDivElement>(null);


  // Initialize canvas and context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;
    
    contextRef.current = context;
    // Set initial canvas properties (can be reset on clear or tool change)
    context.lineCap = 'round';
    context.lineJoin = 'round';

  }, []);

  // Resize canvas to fit container
   useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasWidth(width);
        setCanvasHeight(height);
      }
    });

    resizeObserver.observe(container);
    
    // Initial size
    setCanvasWidth(container.clientWidth);
    setCanvasHeight(container.clientHeight);

    return () => resizeObserver.unobserve(container);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas || !contextRef.current) return;
    
    // Preserve drawing when resizing - this is a basic approach
    // For complex drawings, a more robust method (e.g., redrawing paths) would be needed
    const imageData = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    if(contextRef.current) { // Re-check context as it might be reset by width/height change
        contextRef.current.lineCap = 'round';
        contextRef.current.lineJoin = 'round';
        contextRef.current.strokeStyle = currentColor;
        contextRef.current.lineWidth = currentLineWidth;
        contextRef.current.putImageData(imageData, 0, 0);
    }

  }, [canvasWidth, canvasHeight, currentColor, currentLineWidth]);


  const getMousePosition = (event: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    if (event.nativeEvent instanceof MouseEvent) {
        return {
            x: event.nativeEvent.clientX - rect.left,
            y: event.nativeEvent.clientY - rect.top,
        };
    } else if (event.nativeEvent instanceof TouchEvent && event.nativeEvent.touches.length > 0) {
         return {
            x: event.nativeEvent.touches[0].clientX - rect.left,
            y: event.nativeEvent.touches[0].clientY - rect.top,
        };
    }
    return null;
  };

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const context = contextRef.current;
    const pos = getMousePosition(event);
    if (!context || !pos) return;

    isDrawingRef.current = true;
    context.beginPath();
    context.moveTo(pos.x, pos.y);
    lastPositionRef.current = pos;
     // Prevent page scroll on touch devices
    if (event.nativeEvent instanceof TouchEvent) {
      event.preventDefault();
    }
  }, []);

  const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const context = contextRef.current;
    const pos = getMousePosition(event);
    if (!context || !pos || !lastPositionRef.current) return;

    context.strokeStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor; // Assuming white background for eraser
    context.lineWidth = currentLineWidth;
    
    context.lineTo(pos.x, pos.y);
    context.stroke();
    
    lastPositionRef.current = pos;
     // Prevent page scroll on touch devices
    if (event.nativeEvent instanceof TouchEvent) {
      event.preventDefault();
    }
  }, [currentColor, currentLineWidth, currentTool]);

  const stopDrawing = useCallback(() => {
    const context = contextRef.current;
    if (!context || !isDrawingRef.current) return;
    
    context.closePath();
    isDrawingRef.current = false;
    lastPositionRef.current = null;
  }, []);

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    // Optionally fill with white if you want a non-transparent background
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleToolChange = (tool: 'pen' | 'eraser') => {
    setCurrentTool(tool);
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="p-2 border-b flex flex-wrap gap-2 items-center justify-center shrink-0 bg-muted">
        {colors.map((color) => (
          <Button
            key={color.name}
            variant={currentColor === color.value && currentTool !== 'eraser' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setCurrentColor(color.value);
              if (color.name.toLowerCase().includes('eraser')) { // Basic eraser detection
                 handleToolChange('eraser');
              } else {
                 handleToolChange('pen');
              }
            }}
            style={{ backgroundColor: color.value, color: color.value === '#FFFFFF' || color.value === '#FFFF00' ? '#000' : '#FFF',  border: currentColor === color.value ? '2px solid teal' : '2px solid transparent' }}
            title={color.name}
            className="w-8 h-8 p-0 rounded-full"
          >
           {/* {color.name.substring(0,1)} */}
          </Button>
        ))}
        <div className="mx-2 h-6 border-l border-border"></div>
        {lineSizes.map((size) => (
          <Button
            key={size.name}
            variant={currentLineWidth === size.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentLineWidth(size.value)}
            title={size.name}
            className="px-3"
          >
            {size.name}
          </Button>
        ))}
         <div className="mx-2 h-6 border-l border-border"></div>
        <Button
          variant={currentTool === 'pen' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleToolChange('pen')}
          title="Pen Tool"
        >
          <BrushIcon size={18} />
        </Button>
        <Button
          variant={currentTool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleToolChange('eraser')}
          title="Eraser Tool"
        >
          <Eraser size={18} />
        </Button>
        <Button variant="destructive" size="sm" onClick={handleClearCanvas} title="Clear Canvas">
          <Trash2 size={18} className="mr-1" /> Clear
        </Button>
      </div>
      <div ref={containerRef} className="flex-grow relative w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing} // Stop drawing if mouse leaves canvas
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair bg-white shadow-lg" 
          // Width and height are set by state for reactivity to container size
          width={canvasWidth} 
          height={canvasHeight}
        />
      </div>
    </div>
  );
}

