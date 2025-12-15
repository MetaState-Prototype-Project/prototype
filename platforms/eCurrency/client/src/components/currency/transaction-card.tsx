import { ArrowLeft, ArrowRight, Sparkles, Flame } from "lucide-react";
import { formatEName } from "../../lib/utils";

interface TransactionCardProps {
  transaction: any;
  currencyName?: string;
  onClick: () => void;
}

export default function TransactionCard({ transaction, currencyName, onClick }: TransactionCardProps) {
  // For credits: show "Received from X", for debits: show "Sent to X"
  // For minted: show "Minted", for burned: show "Burned"
  let mainText = "";
  const isMinted = transaction.description?.toLowerCase().includes("minted");
  const isBurned = transaction.description?.toLowerCase().includes("burned") || transaction.description?.toLowerCase().includes("burn");
  
  if (isMinted) {
    mainText = "Minted";
  } else if (isBurned) {
    mainText = "Burned";
  } else if (transaction.type === "credit") {
    const senderName = transaction.sender?.name || formatEName(transaction.sender?.ename) || "Unknown";
    mainText = `Received from ${senderName}`;
  } else {
    const receiverName = transaction.receiver?.name || formatEName(transaction.receiver?.ename) || "Unknown";
    mainText = `Sent to ${receiverName}`;
  }

  return (
    <div
      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isMinted
                ? "bg-purple-100"
                : isBurned
                  ? "bg-red-100"
                  : transaction.type === "credit"
                    ? "bg-green-100"
                    : "bg-blue-100"
            }`}
          >
            {isMinted ? (
              <Sparkles className="h-5 w-5 text-purple-600" />
            ) : isBurned ? (
              <Flame className="h-5 w-5 text-red-600" />
            ) : transaction.type === "credit" ? (
              <ArrowLeft className="h-5 w-5 text-green-600" />
            ) : (
              <ArrowRight className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <div className="font-medium">
              {mainText}
            </div>
            <div className="text-sm text-muted-foreground">
              {currencyName && `${currencyName} · `}
              {new Date(transaction.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`font-semibold ${
              transaction.type === "credit" ? "text-green-600" : "text-blue-600"
            }`}
          >
            {transaction.type === "credit" ? "+" : "-"}
            {Math.abs(Number(transaction.amount)).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-sm text-muted-foreground">
            Balance: {Number(transaction.balance).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

