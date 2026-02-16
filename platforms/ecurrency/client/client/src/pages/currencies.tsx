import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { useAuth } from "../hooks/useAuth";
import MintCurrencyModal from "../components/currency/mint-currency-modal";
import { Sparkles } from "lucide-react";
import { formatEName } from "../lib/utils";

export default function Currencies() {
  const { user } = useAuth();
  const [mintModalOpen, setMintModalOpen] = useState(false);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);

  const { data: currencies, isLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const response = await apiClient.get("/api/currencies");
      return response.data;
    },
  });

  const { data: groups } = useQuery({
    queryKey: ["userGroups"],
    queryFn: async () => {
      const response = await apiClient.get("/api/groups/my");
      return response.data;
    },
  });

  const isAdminOfGroup = (groupId: string) => {
    return groups?.some((g: any) => g.id === groupId && g.isAdmin) || false;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">All Currencies</h1>

        {isLoading ? (
          <div>Loading currencies...</div>
        ) : currencies && currencies.length > 0 ? (
          <div className="space-y-2">
            {currencies.map((currency: any) => {
              const canMint = isAdminOfGroup(currency.groupId);
              return (
                <div
                  key={currency.id}
                  className="p-4 border rounded-lg flex justify-between items-center hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{currency.name}</h3>
                      {canMint && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{formatEName(currency.ename)}</p>
                    {currency.description && (
                      <p className="text-sm text-muted-foreground mt-1">{currency.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {currency.allowNegative ? "Allows negative balances" : "No negative balances"}
                    </p>
                  </div>
                  {canMint && (
                    <button
                      onClick={() => {
                        setSelectedCurrencyId(currency.id);
                        setMintModalOpen(true);
                      }}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Mint
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground">No currencies available</p>
        )}
      </div>

      {selectedCurrencyId && (
        <MintCurrencyModal
          open={mintModalOpen}
          onOpenChange={(open) => {
            setMintModalOpen(open);
            if (!open) setSelectedCurrencyId(null);
          }}
          currencyId={selectedCurrencyId}
        />
      )}
    </div>
  );
}
