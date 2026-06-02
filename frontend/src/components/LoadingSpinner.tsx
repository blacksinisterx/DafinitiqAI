export default function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-500 text-sm">
      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span>{text}</span>
    </div>
  );
}
