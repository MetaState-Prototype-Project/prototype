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
  // For account initialization: show "Account Created"
  let mainText = "";
  const desc = transaction.description?.toLowerCase() || "";
  const balance = Number(transaction.balance) || 0;
  const amount = Math.abs(Number(transaction.amount)) || 0;
  
  // Check description for mint/burn keywords
  const hasMintInDesc = desc.includes("minted") || desc.includes("mint");
  const hasBurnInDesc = desc.includes("burned") || desc.includes("burn");
  const hasInitInDesc = desc.includes("initialized") || desc.includes("account created");
  
  // Account initialization: balance is 0, amount is 0 (or very close), no sender
  const isAccountInit = balance === 0 && amount < 0.01 && 
    (!transaction.sender || (!transaction.sender.name && !transaction.sender.ename)) &&
    (hasInitInDesc || transaction.description === "Account initialized");
  
  // Fallback: credit with no sender and group account type is likely a mint (but not if balance is 0)
  const isLikelyMint = transaction.type === "credit" && 
    (!transaction.sender || (!transaction.sender.name && !transaction.sender.ename)) &&
    transaction.accountType === "group" &&
    balance > 0; // Only consider it a mint if balance is positive
  
  // Debit with no receiver and group account type is likely a burn
  const isLikelyBurn = transaction.type === "debit" &&
    (!transaction.receiver || (!transaction.receiver.name && !transaction.receiver.ename)) &&
    transaction.accountType === "group";
  
  const isMinted = hasMintInDesc || isLikelyMint;
  const isBurned = hasBurnInDesc || isLikelyBurn;
  
  if (isAccountInit) {
    mainText = "Account Created";
  } else if (isMinted) {
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

