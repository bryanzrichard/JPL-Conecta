import React from 'react';
import { Skeleton } from './Skeleton';

export const TableSkeleton: React.FC = () => {
    return (
        <div className="hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900 shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="bg-brand-dark-950/50 border-b border-gray-800">
                        <tr>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <th key={i} className="px-6 py-4">
                                    <Skeleton className="h-4 w-24" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {Array.from({ length: 5 }).map((_, rowIndex) => (
                            <tr key={rowIndex} className="bg-brand-dark-900">
                                {Array.from({ length: 5 }).map((_, colIndex) => (
                                    <td key={colIndex} className="px-6 py-4">
                                        <Skeleton className="h-4 w-full" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
