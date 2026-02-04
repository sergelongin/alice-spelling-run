import { useState, useEffect } from 'react';

interface ViewportState {
  height: number;
  offsetTop: number;
  isKeyboardVisible: boolean;
}

/**
 * Hook to detect visual viewport changes, particularly useful for detecting
 * when a soft keyboard appears on mobile/tablet devices.
 *
 * Uses the Visual Viewport API to track viewport size changes.
 * When the visual viewport height is significantly smaller than the window
 * inner height, we can infer that a soft keyboard is visible.
 */
export function useVisualViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>({
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    offsetTop: 0,
    isKeyboardVisible: false,
  });

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      // Visual Viewport API not supported - fall back to window resize
      const handleResize = () => {
        setState({
          height: window.innerHeight,
          offsetTop: 0,
          isKeyboardVisible: false,
        });
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const handleViewportChange = () => {
      const keyboardThreshold = 150; // px - keyboard typically takes 300-500px
      const heightDiff = window.innerHeight - viewport.height;

      setState({
        height: viewport.height,
        offsetTop: viewport.offsetTop,
        isKeyboardVisible: heightDiff > keyboardThreshold,
      });
    };

    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);

    // Initial call
    handleViewportChange();

    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return state;
}
