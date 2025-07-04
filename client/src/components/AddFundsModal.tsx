import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Smartphone, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddFundsModal({ isOpen, onClose }: AddFundsModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ecocash');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addFundsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/payments/ecocash/initiate', data);
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "EcoCash Payment Initiated!",
        description: `Payment of ${formatCurrency(amount)} initiated. Reference: ${result.ecocashReference}. Check your phone for the payment prompt.`,
      });
      
      // Auto-refresh user profile after 3 seconds to show updated balance
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      }, 3000);
      
      onClose();
      setAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Unable to process EcoCash payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const quickAmounts = ['5.00', '10.00', '20.00', '50.00'];

  const handleQuickAmount = (quickAmount: string) => {
    setAmount(quickAmount);
  };

  const handleAddFunds = () => {
    const numericAmount = parseFloat(amount);
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than $0.",
        variant: "destructive",
      });
      return;
    }

    if (numericAmount < 1) {
      toast({
        title: "Minimum Amount",
        description: "Minimum deposit amount is $1.00.",
        variant: "destructive",
      });
      return;
    }

    addFundsMutation.mutate({
      amount: numericAmount.toFixed(2),
      paymentMethod,
    });
  };

  const handleClose = () => {
    if (!addFundsMutation.isPending) {
      onClose();
      setAmount('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-green-800">Add Funds to Wallet</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Amount Input */}
          <div>
            <Label htmlFor="amount" className="text-green-800 font-medium">
              Amount (USD)
            </Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-8"
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <Label className="text-green-800 font-medium mb-2 block">Quick Amounts</Label>
            <div className="grid grid-cols-2 gap-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  onClick={() => handleQuickAmount(quickAmount)}
                  className="h-12 text-lg font-medium"
                >
                  ${quickAmount}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Payment Method */}
          <div>
            <Label className="text-green-800 font-medium mb-3 block">Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="ecocash" id="ecocash-add" />
                <Label htmlFor="ecocash-add" className="flex items-center cursor-pointer flex-1">
                  <Smartphone className="w-4 h-4 text-green-600 mr-2" />
                  EcoCash Mobile Money
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="card" id="card-add" />
                <Label htmlFor="card-add" className="flex items-center cursor-pointer flex-1">
                  <CreditCard className="w-4 h-4 text-blue-600 mr-2" />
                  Debit/Credit Card
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* EcoCash Instructions */}
          {paymentMethod === 'ecocash' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">EcoCash Payment</h4>
              <p className="text-sm text-green-700">
                You will be redirected to EcoCash to complete your payment securely.
              </p>
            </div>
          )}
          
          {/* Add Funds Button */}
          <Button 
            onClick={handleAddFunds}
            disabled={addFundsMutation.isPending || !amount || parseFloat(amount) <= 0}
            className="w-full gradient-forest text-white py-4 text-lg font-bold"
          >
            {addFundsMutation.isPending ? "Processing..." : `Add ${amount ? formatCurrency(amount) : '$0.00'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
