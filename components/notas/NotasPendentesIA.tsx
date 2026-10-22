import React from 'react';
import { AIProcessJob } from '../../types';
import JobCard from './JobCard';

export type LocalJob = AIProcessJob & {
    customText?: string;
};

interface NotasPendentesIAProps {
  jobs: LocalJob[];
  isLoading: boolean;
  onSelectJob: (job: AIProcessJob) => void;
  onArchiveOrCancelJob: (job: AIProcessJob) => void;
}

const NotasPendentesIA: React.FC<NotasPendentesIAProps> = ({ jobs, isLoading, onSelectJob, onArchiveOrCancelJob }) => {
  if (isLoading || jobs.length === 0) {
    return null; 
  }

  return (
    <div className="flex flex-col gap-2 bg-brand-dark-900/30 p-2 rounded-xl border border-gray-800/50">
        {jobs.map((job) => (
            <JobCard 
                key={job.id} 
                job={job} 
                customText={job.customText}
                onSelect={onSelectJob} 
                onArchiveOrCancel={onArchiveOrCancelJob} 
            />
        ))}
    </div>
  );
};

export default NotasPendentesIA;