import { Cloud, Loader2 } from 'lucide-react';

interface InitialSyncLoaderProps {
  childName?: string;
}

export function InitialSyncLoader({ childName }: InitialSyncLoaderProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <div className="relative">
        <Cloud className="w-20 h-20 text-blue-400" />
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin absolute bottom-0 right-0" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Loading your progress...
        </h2>
        <p className="text-gray-600">
          {childName ? `Getting ${childName}'s data from the cloud` : 'Syncing your data'}
        </p>
      </div>
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
