import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, CreditCard, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Checkout() {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Fetch billing packages
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["/api/admin/billing-packages"],
  });

  // Fetch current organization data  
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const handlePayment = async () => {
    if (!selectedPackage) {
      toast({
        title: "Select a package",
        description: "Please select a billing package to continue",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const selectedPkg = packages.find((p: any) => p.id === selectedPackage);
      
      // Create payment intent
      const response = await apiRequest("POST", "/api/payments/create-intent", {
        packageId: selectedPackage,
        amount: selectedPkg.monthlyPrice,
      });

      if (response.ok) {
        const data = await response.json();
        
        // In production, this would redirect to Stripe checkout or show payment form
        toast({
          title: "Payment Processing",
          description: "Payment gateway integration will be available once configured by admin.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Payment Setup Required",
          description: error.error || "Payment gateway is not configured. Please contact support.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Select the perfect plan for your organization's voice AI monitoring needs
        </p>
      </div>

      {/* Alert for payment gateway status */}
      <Card className="p-4 mb-6 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Payment Gateway Status</p>
            <p className="text-sm text-muted-foreground">
              Payment processing will be available once your administrator configures Stripe or PayPal. 
              Contact support for assistance.
            </p>
          </div>
        </div>
      </Card>

      {/* Billing Packages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {packages.map((pkg: any) => (
          <Card
            key={pkg.id}
            className={`p-6 cursor-pointer transition-all ${
              selectedPackage === pkg.id
                ? "ring-2 ring-primary border-primary"
                : "hover:shadow-lg"
            }`}
            onClick={() => setSelectedPackage(pkg.id)}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{pkg.displayName}</h3>
                  <Badge variant="secondary" className="mt-1">
                    {pkg.name}
                  </Badge>
                </div>
                {selectedPackage === pkg.id && (
                  <CheckCircle className="w-6 h-6 text-primary" />
                )}
              </div>

              <div className="pt-4 border-t">
                <div className="text-3xl font-bold">
                  ${pkg.monthlyPrice}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Agents</span>
                  <span className="font-medium">{pkg.maxAgents}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Users</span>
                  <span className="font-medium">{pkg.maxUsers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Credits</span>
                  <span className="font-medium">{pkg.monthlyCredits || 'Unlimited'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Per Call Rate</span>
                  <span className="font-medium">${pkg.perCallRate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Per Minute Rate</span>
                  <span className="font-medium">${pkg.perMinuteRate}</span>
                </div>
              </div>

              {pkg.features && pkg.features.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  {pkg.features.map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Payment Summary */}
      {selectedPackage && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Payment Summary</h3>
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selected Plan</span>
              <span className="font-medium">
                {packages.find((p: any) => p.id === selectedPackage)?.displayName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billing Cycle</span>
              <span className="font-medium">Monthly</span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-3 border-t">
              <span>Total</span>
              <span>
                ${packages.find((p: any) => p.id === selectedPackage)?.monthlyPrice}/month
              </span>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handlePayment}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Proceed to Payment
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Secure payment processing powered by Stripe and PayPal
          </p>
        </Card>
      )}
    </div>
  );
}