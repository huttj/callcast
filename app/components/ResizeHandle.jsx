'use client'

import { useEffect, useRef } from 'react';
import './ResizeHandle.css';

function ResizeHandle({ onResize, direction = 'vertical' }) {
  const isDragging = useRef(false);
  const startPos = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;

      const delta = direction === 'vertical'
        ? e.clientX - startPos.current
        : e.clientY - startPos.current;

      onResize(delta);
      startPos.current = direction === 'vertical' ? e.clientX : e.clientY;
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize, direction]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    startPos.current = direction === 'vertical' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      className={`resize-handle resize-handle-${direction}`}
      onMouseDown={handleMouseDown}
    >
      <div className="resize-handle-line" />
    </div>
  );
}

export default ResizeHandle;
