import { Button } from "@/components/ui/button";

interface GlobalErrorDisplayProps {
  error: string | null;
  onClose: () => void;
}

export const GlobalErrorDisplay: React.FC<GlobalErrorDisplayProps> = ({
  error,
  onClose,
}) => {
  if (!error) return null;
  return (
    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex justify-between items-center">
      <p>{error}</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="text-red-700 hover:bg-red-200"
      >
        닫기
      </Button>
    </div>
  );
};
