import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { X } from "lucide-react";
import { formatEName } from "@/lib/utils";

interface TransactionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId?: string;
}

export default function TransactionDetailModal({
  open,
  onOpenChange,
  transactionId,
}: TransactionDetailModalProps) {
  const { data: transaction } = useQuery({
    queryKey: ["transaction", transactionId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/ledger/transaction/${transactionId}`);
      return response.data;
    },
    enabled: !!transactionId && open,
  });

  if (!open || !transactionId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Transaction Details</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {transaction ? (
          <div className="space-y-6">
            {/* Transaction ID */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Transaction ID</h3>
              <p className="font-mono text-sm">{transaction.id}</p>
            </div>

            {/* Description - Always show if it exists */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
              <p className="text-lg">{transaction.description || "No description"}</p>
            </div>

            {/* Amount and Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Amount</h3>
                <p
                  className={`text-2xl font-bold ${
                    transaction.type === "credit" ? "text-green-600" : "text-blue-600"
                  }`}
                >
                  {transaction.type === "credit" ? "+" : "-"}
                  {Math.abs(Number(transaction.amount)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Type</h3>
                <p className="text-lg font-semibold capitalize">{transaction.type}</p>
              </div>
            </div>

            {/* Balance */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Balance After Transaction</h3>
              <p className="text-xl font-semibold">
                {Number(transaction.balance).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            {/* For credits: show who sent it, for debits: show who it's for */}
            {transaction.type === "credit" && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">From</h3>
                {transaction.sender ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div>
                      <span className="text-sm text-muted-foreground">Name: </span>
                      <span className="font-medium">{transaction.sender.name || transaction.sender.handle || "Unknown"}</span>
                    </div>
                    {transaction.sender.ename && (
                      <div>
                        <span className="text-sm text-muted-foreground">eName: </span>
                        <span className="font-mono text-sm">{formatEName(transaction.sender.ename)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Sender information not available</p>
                  </div>
                )}
              </div>
            )}

            {transaction.type === "debit" && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">To</h3>
                {transaction.receiver ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div>
                      <span className="text-sm text-muted-foreground">Name: </span>
                      <span className="font-medium">{transaction.receiver.name || transaction.receiver.handle || "Unknown"}</span>
                    </div>
                  {transaction.receiver.ename && (
                    <div>
                      <span className="text-sm text-muted-foreground">eName: </span>
                      <span className="font-mono text-sm">{formatEName(transaction.receiver.ename)}</span>
                    </div>
                  )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Receiver information not available</p>
                  </div>
                )}
              </div>
            )}

            {/* Currency */}
            {transaction.currency && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Currency</h3>
                <p className="text-lg font-semibold">
                  {transaction.currency.name} ({formatEName(transaction.currency.ename)})
                </p>
              </div>
            )}

            {/* Timestamp */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Date & Time</h3>
              <p className="text-lg">
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading transaction details...</p>
          </div>
        )}
      </div>
    </div>
  );
}

