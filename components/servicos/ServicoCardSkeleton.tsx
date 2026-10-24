import React from 'react';
import { Skeleton } from '../ui/Skeleton';

const ServicoCardSkeleton = () => (
  <div className="bg-white dark:bg-brand-dark-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800/60 shadow-sm">
    <div className="flex justify-between items-start mb-3">
        <div className="pr-4 flex-1 space-y-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
    </div>

    <div className="h-px w-full bg-gray-100 dark:bg-gradient-to-r dark:from-gray-800/50 dark:via-gray-800/20 dark:to-transparent my-3" />

    <div className="flex items-end justify-between">
        <div className="space-y-2 flex-1 pr-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
    </div>
  </div>
);

export default ServicoCardSkeleton;
