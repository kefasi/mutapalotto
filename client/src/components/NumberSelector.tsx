import { cn } from "@/lib/utils";

interface NumberSelectorProps {
  selectedNumbers: number[];
  onSelectionChange: (numbers: number[]) => void;
  maxNumber: number;
  requiredCount: number;
}

export default function NumberSelector({
  selectedNumbers,
  onSelectionChange,
  maxNumber,
  requiredCount
}: NumberSelectorProps) {
  
  const handleNumberClick = (number: number) => {
    let newSelection = [...selectedNumbers];
    
    if (selectedNumbers.includes(number)) {
      // Remove number
      newSelection = selectedNumbers.filter(n => n !== number);
    } else if (selectedNumbers.length < requiredCount) {
      // Add number if under limit
      newSelection = [...selectedNumbers, number];
    }
    
    onSelectionChange(newSelection);
  };

  // Generate grid of numbers
  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {numbers.slice(0, Math.min(25, maxNumber)).map((number) => (
          <button
            key={number}
            onClick={() => handleNumberClick(number)}
            className={cn(
              "w-12 h-12 border-2 rounded-lg flex items-center justify-center cursor-pointer transition-all font-medium",
              selectedNumbers.includes(number)
                ? "border-yellow-400 bg-yellow-400 text-green-800"
                : "border-gray-300 hover:border-yellow-400 text-gray-700"
            )}
          >
            {number}
          </button>
        ))}
      </div>
      
      {maxNumber > 25 && (
        <div className="grid grid-cols-5 gap-2">
          {numbers.slice(25).map((number) => (
            <button
              key={number}
              onClick={() => handleNumberClick(number)}
              className={cn(
                "w-12 h-12 border-2 rounded-lg flex items-center justify-center cursor-pointer transition-all font-medium",
                selectedNumbers.includes(number)
                  ? "border-yellow-400 bg-yellow-400 text-green-800"
                  : "border-gray-300 hover:border-yellow-400 text-gray-700"
              )}
            >
              {number}
            </button>
          ))}
        </div>
      )}
      
      <div className="text-sm text-gray-600 text-center">
        Selected: {selectedNumbers.length}/{requiredCount}
      </div>
    </div>
  );
}
