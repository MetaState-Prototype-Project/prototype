import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "wouter";
import CreateCurrencyModal from "../components/currency/create-currency-modal";
import AddCurrencyAccountModal from "../components/currency/add-currency-account-modal";
import TransferModal from "../components/currency/transfer-modal";
import TransactionDetailModal from "../components/currency/transaction-detail-modal";
import UserMenuDropdown from "../components/user-menu-dropdown";
import { Plus, Wallet, ArrowRightLeft, Send } from "lucide-react";
import { formatEName } from "../lib/utils";
import TransactionCard from "../components/currency/transaction-card";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [createCurrencyOpen, setCreateCurrencyOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedCurrencyForTransfer, setSelectedCurrencyForTransfer] = useState<string | undefined>();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [transactionOffset, setTransactionOffset] = useState(0);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const PAGE_SIZE = 10;

  // Load account context from localStorage on mount, default to user account
  const [accountContext, setAccountContext] = useState<{ type: "user" | "group"; id: string } | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ecurrency_account_context");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const { data: groups } = useQuery({
    queryKey: ["userGroups"],
    queryFn: async () => {
      const response = await apiClient.get("/api/groups/my");
      return response.data;
    },
  });

  // Validate account context after user and groups are loaded
  useEffect(() => {
    if (!user) return;

    const adminGroups = groups?.filter((g: any) => g.isAdmin) || [];

    // If no context is set, default to user account
    if (!accountContext) {
      const defaultContext = { type: "user" as const, id: user.id };
      setAccountContext(defaultContext);
      localStorage.setItem("ecurrency_account_context", JSON.stringify(defaultContext));
      return;
    }

    // Validate the saved context
    let isValid = false;

    if (accountContext.type === "user") {
      // User context must match current user ID
      isValid = accountContext.id === user.id;
    } else if (accountContext.type === "group") {
      // Group context must be in admin groups list
      isValid = adminGroups.some((g: any) => g.id === accountContext.id);
    }

    // If invalid, reset to user account
    if (!isValid) {
      const defaultContext = { type: "user" as const, id: user.id };
      setAccountContext(defaultContext);
      localStorage.setItem("ecurrency_account_context", JSON.stringify(defaultContext));
    }
  }, [user, groups, accountContext]);

  // Save account context to localStorage whenever it changes
  const handleAccountContextChange = (context: { type: "user" | "group"; id: string } | null) => {
    // If null is passed, default to user account
    const finalContext = context || (user ? { type: "user" as const, id: user.id } : null);
    setAccountContext(finalContext);
    if (finalContext) {
      localStorage.setItem("ecurrency_account_context", JSON.stringify(finalContext));
    } else {
      localStorage.removeItem("ecurrency_account_context");
    }
  };

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["balances", accountContext],
    queryFn: async () => {
      const params = accountContext?.type === "group"
        ? `?accountType=group&accountId=${accountContext.id}`
        : "";
      const response = await apiClient.get(`/api/ledger/balance${params}`);
      return response.data;
    },
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["history", accountContext, transactionOffset],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("limit", String(PAGE_SIZE));
      params.append("offset", String(transactionOffset));
      if (accountContext?.type === "group") {
        params.append("accountType", "group");
        params.append("accountId", accountContext.id);
      }
      const response = await apiClient.get(`/api/ledger/history?${params.toString()}`);
      return response.data;
    },
  });

  // Reset offset and transactions when account context changes
  useEffect(() => {
    setTransactionOffset(0);
    setAllTransactions([]);
  }, [accountContext]);

  // Accumulate transactions when new data arrives
  useEffect(() => {
    if (transactions) {
      if (transactionOffset === 0) {
        // First page - replace all
        setAllTransactions(transactions);
      } else {
        // Subsequent pages - append
        setAllTransactions(prev => [...prev, ...transactions]);
      }
    }
  }, [transactions, transactionOffset]);

  const { data: currencies } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const response = await apiClient.get("/api/currencies");
      return response.data;
    },
  });

  const hasAdminGroups = groups?.some((g: any) => g.isAdmin) || false;

  const getCurrencyName = (currencyId: string) => {
    return currencies?.find((c: any) => c.id === currencyId)?.name || "Unknown";
  };

  const formatTransactionType = (type: string, amount: number) => {
    if (type === "credit") {
      return { label: "Received", color: "text-green-600" };
    } else {
      return { label: "Sent", color: "text-red-600" };
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 justify-center items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-100 via-cyan-100 to-blue-100 rounded-xl flex items-center justify-center shadow-sm">
                <Wallet className="h-5 w-5 text-teal-600" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-700 via-cyan-700 to-blue-700 bg-clip-text text-transparent">eCurrency</h1>
            </div>
            <div className="flex items-center gap-4">
              <UserMenuDropdown
                accountContext={accountContext}
                onAccountContextChange={handleAccountContextChange}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Currency Cards */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Your accounts</h2>
          {balancesLoading ? (
            <div className="text-muted-foreground">Loading balances...</div>
          ) : balances && balances.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {balances.map((balance: any) => (
                <div
                  key={balance.currency.id}
                  className="bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setLocation(`/currency/${balance.currency.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {balance.currency.name.charAt(0)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCurrencyForTransfer(balance.currency.id);
                        setTransferOpen(true);
                      }}
                      className="text-white hover:text-white/80"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-sm text-white/90 mb-1">{balance.currency.name}</div>
                  <div className="text-2xl font-bold text-white">
                    {Number(balance.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-white/80 mt-1">{formatEName(balance.currency.ename)}</div>
                  {balance.currency.allowNegative !== undefined && (
                    <div className="text-xs px-2 py-0.5 rounded bg-white/20 text-white/90 mt-1 inline-block">
                      {balance.currency.allowNegative ? "Negative Allowed" : "No Negative"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed rounded-lg text-center bg-gray-50">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No currency accounts yet</p>
              <button
                onClick={() => setAddAccountOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Your First Currency Account
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons Below Cards */}
        <div className="flex gap-3 mb-8">
          {hasAdminGroups && accountContext?.type === "group" && (
            <button
              onClick={() => setCreateCurrencyOpen(true)}
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Currency
            </button>
          )}
          <button
            onClick={() => setAddAccountOpen(true)}
            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Wallet className="h-4 w-4" />
            Add Currency Account
          </button>
        </div>

        {/* Transactions */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Transactions</h2>
            <button
              onClick={() => setTransferOpen(true)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-2 font-medium"
            >
              <Send className="h-4 w-4" />
              Make a transfer
            </button>
          </div>

          {transactionsLoading && transactionOffset === 0 && allTransactions.length === 0 ? (
            <div className="bg-white border rounded-lg p-12 text-center">
              <div className="text-muted-foreground">Loading transactions...</div>
            </div>
          ) : allTransactions.length > 0 ? (
            <>
              <div className="bg-white border rounded-lg divide-y">
                {allTransactions.map((transaction: any) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    currencyName={getCurrencyName(transaction.currencyId)}
                    onClick={() => setSelectedTransactionId(transaction.id)}
                  />
                ))}
              </div>
              {transactions && transactions.length === PAGE_SIZE && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setTransactionOffset(prev => prev + PAGE_SIZE)}
                    disabled={transactionsLoading}
                    className="px-6 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {transactionsLoading ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border rounded-lg p-12 text-center">
              <ArrowRightLeft className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
              <p className="text-muted-foreground mb-4">
                Your transaction history will appear here once you start making transfers.
              </p>
              <button
                onClick={() => setTransferOpen(true)}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 inline-flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                Make your first transfer
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateCurrencyModal
        open={createCurrencyOpen}
        onOpenChange={setCreateCurrencyOpen}
        groups={groups || []}
      />
      <AddCurrencyAccountModal open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      <TransferModal
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) setSelectedCurrencyForTransfer(undefined);
        }}
        fromCurrencyId={selectedCurrencyForTransfer}
        accountContext={accountContext}
      />
      <TransactionDetailModal
        open={!!selectedTransactionId}
        onOpenChange={(open) => !open && setSelectedTransactionId(null)}
        transactionId={selectedTransactionId || undefined}
      />
    </div>
  );
}
