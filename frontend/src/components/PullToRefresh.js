import { useState, useRef, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';

export default function PullToRefresh({ children, onRefresh, threshold = 80 }) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isTouch = useRef(false);

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      isTouch.current = true;
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (!isTouch.current) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;
    
    if (distance > 0) {
      e.preventDefault();
      const distance_capped = Math.min(distance, 120);
      setPullDistance(distance_capped);
      setIsPulling(true);
    }
  };

  const handleTouchEnd = async () => {
    if (!isTouch.current) return;
    isTouch.current = false;
    
    if (pullDistance >= 80) {
      setIsPulling(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      }
    }
    
    setIsPulling(false);
    setPullDistance(0);
    startY.current = 0;
  };

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{ position: 'relative', overflow: 'hidden' }}
    >
      <Box
        sx={{
          height: pullDistance > 0 ? pullDistance : 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'height 0.2s ease-out',
          overflow: 'hidden'
        }}
      >
        {pullDistance > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
            }}
          >
            <CircularProgress
              size={24}
              color="primary"
              sx={{ transform: `rotate(${Math.min(pullDistance / 80, 1) * 360}deg)` }}
            />
          )}
        {isTouch.current && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 12,
              color: 'text.secondary',
              opacity: pullDistance > 80 ? 1 : pullDistance / 80,
            }}
          >
            {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        )}
      </Box>
      {children}
    </Box>
  );
}

export default PullToRefresh;