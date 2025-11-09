'use client';

interface ToolUsageProps {
  tool: string;
  toolUseId: string;
  status: 'running' | 'complete';
  result?: string;
}

export default function ToolUsage({ tool, toolUseId, status, result }: ToolUsageProps) {
  return (
    <div className="my-3 rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden">
      {/* Tool header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-100/50 border-b border-blue-200">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 text-blue-600 ${status === 'running' ? 'animate-spin' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
        <span className="text-sm font-medium text-blue-900">{tool}</span>
        {status === 'running' && (
          <span className="ml-auto text-xs text-blue-600">Running...</span>
        )}
      </div>

      {/* Tool result */}
      {result && status === 'complete' && (
        <div className="px-3 py-2 text-sm text-blue-800 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
          {result}
        </div>
      )}
    </div>
  );
}
