import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shuffle, Plus, Minus, Sparkles, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TicketPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TicketPurchaseModal({ isOpen, onClose }: TicketPurchaseModalProps) {
  const [selectedDraw, setSelectedDraw] = useState<'daily' | 'weekly'>('daily');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: upcomingDraws } = useQuery({
    queryKey: ["/api/draws/upcoming"],
  });

  const { data: user } = useQuery({
    queryKey: ["/api/user/profile"],
  });

  const purchaseTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/tickets/purchase", data);
    },
    onSuccess: () => {
      toast({
        title: "Ticket Purchased!",
        description: `Successfully purchased ${quantity} ticket(s) for the ${selectedDraw} draw.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      console.error("Purchase error:", error);
      
      // Handle duplicate numbers error specifically
      if (error.code === "DUPLICATE_NUMBERS") {
        toast({
          title: "Numbers Already Taken",
          description: "Another player has already selected these numbers. Please choose different numbers.",
          variant: "destructive",
        });
        // Generate new quick pick numbers automatically
        setTimeout(() => generateQuickPick(), 1000);
      } else {
        toast({
          title: "Purchase Failed",
          description: error.message || "Failed to purchase ticket",
          variant: "destructive",
        });
      }
    },
  });

  const maxNumbers = selectedDraw === 'daily' ? 5 : 6;
  const maxRange = selectedDraw === 'daily' ? 45 : 49;
  const ticketCost = selectedDraw === 'daily' ? 0.50 : 1.00;
  const totalCost = ticketCost * quantity;
  const canAfford = user && parseFloat(user.balance) >= totalCost;

  const generateQuickPick = () => {
    const numbers: number[] = [];
    while (numbers.length < maxNumbers) {
      const num = Math.floor(Math.random() * maxRange) + 1;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b));
  };

  const toggleNumber = (number: number) => {
    if (selectedNumbers.includes(number)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== number));
    } else if (selectedNumbers.length < maxNumbers) {
      setSelectedNumbers([...selectedNumbers, number].sort((a, b) => a - b));
    }
  };

  const handlePurchase = () => {
    if (selectedNumbers.length !== maxNumbers) {
      toast({
        title: "Invalid Selection",
        description: `Please select exactly ${maxNumbers} numbers.`,
        variant: "destructive",
      });
      return;
    }

    if (!canAfford) {
      toast({
        title: "Insufficient Balance",
        description: "Please add funds to your account first.",
        variant: "destructive",
      });
      return;
    }

    const drawId = selectedDraw === 'daily' ? upcomingDraws?.daily?.id : upcomingDraws?.weekly?.id;
    if (!drawId) {
      toast({
        title: "Draw Not Available",
        description: "No upcoming draw found for this type.",
        variant: "destructive",
      });
      return;
    }

    purchaseTicketMutation.mutate({
      drawId,
      selectedNumbers,
      quantity,
    });
  };

  const resetForm = () => {
    setSelectedNumbers([]);
    setQuantity(1);
    setSelectedDraw('daily');
  };

  const getTimeUntilDraw = (drawDate: string) => {
    const now = new Date();
    const draw = new Date(drawDate);
    const diff = draw.getTime() - now.getTime();
    
    if (diff <= 0) return "Draw in progress";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-green-800">Buy Lottery Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Draw Type Selection */}
          <div>
            <h3 className="font-medium text-green-800 mb-3">Choose Draw Type</h3>
            <div className="grid grid-cols-2 gap-3">
              <Card 
                className={`cursor-pointer transition-all ${
                  selectedDraw === 'daily' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedDraw('daily')}
              >
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="font-medium text-green-800">Daily Draw</p>
                    <p className="text-sm text-gray-600">5 from 45</p>
                    <p className="text-lg font-bold text-yellow-600">{formatCurrency(0.50)}</p>
                    {upcomingDraws?.daily && (
                      <div className="flex items-center justify-center text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimeUntilDraw(upcomingDraws.daily.drawDate)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all ${
                  selectedDraw === 'weekly' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedDraw('weekly')}
              >
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="font-medium text-green-800">Weekly Jackpot</p>
                    <p className="text-sm text-gray-600">6 from 49</p>
                    <p className="text-lg font-bold text-yellow-600">{formatCurrency(1.00)}</p>
                    {upcomingDraws?.weekly && (
                      <div className="flex items-center justify-center text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimeUntilDraw(upcomingDraws.weekly.drawDate)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Number Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-green-800">
                Select {maxNumbers} Numbers
              </h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={generateQuickPick}
                className="text-yellow-600 border-yellow-400 hover:bg-yellow-50"
              >
                <Shuffle className="w-4 h-4 mr-1" />
                Quick Pick
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-3">
              {Array.from({ length: maxRange }, (_, i) => i + 1).map((number) => (
                <Button
                  key={number}
                  variant={selectedNumbers.includes(number) ? "default" : "outline"}
                  size="sm"
                  className={`h-8 w-8 p-0 text-xs ${
                    selectedNumbers.includes(number)
                      ? 'bg-yellow-400 text-green-800 hover:bg-yellow-300'
                      : 'hover:border-yellow-400'
                  }`}
                  onClick={() => toggleNumber(number)}
                  disabled={!selectedNumbers.includes(number) && selectedNumbers.length >= maxNumbers}
                >
                  {number}
                </Button>
              ))}
            </div>

            {selectedNumbers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-sm text-gray-600">Selected:</span>
                {selectedNumbers.map((number) => (
                  <Badge key={number} variant="secondary" className="bg-yellow-100 text-green-800">
                    {number}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Quantity Selection */}
          <div>
            <h3 className="font-medium text-green-800 mb-3">Quantity</h3>
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="font-medium text-lg px-4">{quantity}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.min(10, quantity + 1))}
                disabled={quantity >= 10}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Cost per ticket:</span>
              <span className="font-medium">{formatCurrency(ticketCost)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Quantity:</span>
              <span className="font-medium">{quantity}</span>
            </div>
            <div className="flex justify-between items-center mb-3 text-lg font-bold">
              <span>Total:</span>
              <span className="text-green-800">{formatCurrency(totalCost)}</span>
            </div>
            {user && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Your balance:</span>
                <span className={canAfford ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(parseFloat(user.balance))}
                </span>
              </div>
            )}
          </div>

          {/* Purchase Button */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={
                selectedNumbers.length !== maxNumbers || 
                !canAfford || 
                purchaseTicketMutation.isPending
              }
              className="flex-1 bg-yellow-400 text-green-800 hover:bg-yellow-300"
            >
              {purchaseTicketMutation.isPending ? (
                "Processing..."
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Buy Ticket
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}