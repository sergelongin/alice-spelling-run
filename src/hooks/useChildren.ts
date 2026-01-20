import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { AddChildData, ChildProfile } from '@/types/auth';

interface UseChildrenReturn {
  children: ChildProfile[];
  activeChild: ChildProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  addChild: (data: AddChildData) => Promise<ChildProfile | null>;
  updateChild: (childId: string, data: Partial<Pick<ChildProfile, 'name' | 'grade_level'>>) => Promise<boolean>;
  removeChild: (childId: string) => Promise<boolean>;
  setActiveChild: (childId: string | null) => void;

  // Helpers
  getChildById: (childId: string) => ChildProfile | undefined;
  hasChildren: boolean;
}

/**
 * Hook for managing child profiles
 * Wraps AuthContext child operations with loading/error state
 */
export function useChildren(): UseChildrenReturn {
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addChild = useCallback(
    async (data: AddChildData): Promise<ChildProfile | null> => {
      setIsLoading(true);
      setError(null);

      const result = await auth.addChild(data);

      setIsLoading(false);
      if (result.error) {
        setError(result.error);
        return null;
      }

      return result.child;
    },
    [auth]
  );

  const updateChild = useCallback(
    async (
      childId: string,
      data: Partial<Pick<ChildProfile, 'name' | 'grade_level'>>
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      const result = await auth.updateChild(childId, data);

      setIsLoading(false);
      if (result.error) {
        setError(result.error);
        return false;
      }

      return true;
    },
    [auth]
  );

  const removeChild = useCallback(
    async (childId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      const result = await auth.removeChild(childId);

      setIsLoading(false);
      if (result.error) {
        setError(result.error);
        return false;
      }

      return true;
    },
    [auth]
  );

  const getChildById = useCallback(
    (childId: string): ChildProfile | undefined => {
      return auth.children.find(c => c.id === childId);
    },
    [auth.children]
  );

  return {
    children: auth.children,
    activeChild: auth.activeChild,
    isLoading,
    error,
    addChild,
    updateChild,
    removeChild,
    setActiveChild: auth.setActiveChild,
    getChildById,
    hasChildren: auth.hasChildren,
  };
}
