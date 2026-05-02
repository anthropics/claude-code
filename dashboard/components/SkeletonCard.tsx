export default function SkeletonCard() {
  return (
    <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse h-52">
      <div className="flex items-center justify-between mb-3">
        <div className="w-6 h-6 bg-gray-800 rounded" />
        <div className="w-14 h-4 bg-gray-800 rounded-full" />
      </div>
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-gray-800 rounded w-full" />
        <div className="h-3 bg-gray-800 rounded w-4/5" />
        <div className="h-3 bg-gray-800 rounded w-3/5" />
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between">
          <div className="h-3 w-12 bg-gray-800 rounded" />
          <div className="h-3 w-12 bg-gray-800 rounded" />
        </div>
        <div className="h-2 bg-gray-800 rounded-full" />
      </div>
      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between">
        <div className="h-3 w-16 bg-gray-800 rounded" />
        <div className="h-3 w-10 bg-gray-800 rounded" />
      </div>
    </div>
  );
}
