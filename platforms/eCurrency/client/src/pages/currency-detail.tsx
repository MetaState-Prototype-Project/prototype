import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { apiClient } from "../lib/apiClient";
import { useAuth } from "../hooks/useAuth";
import TransferModal from "../components/currency/transfer-modal";
import TransactionDetailModal from "../components/currency/transaction-detail-modal";
import MintCurrencyModal from "../components/currency/mint-currency-modal";
import UserMenuDropdown from "../components/user-menu-dropdown";
import { Send, Wallet, Sparkles, ChevronLeft, Flame, X } from "lucide-react";
import { useState, useEffect } from "react";
import { formatEName } from "../lib/utils";
import TransactionCard from "../components/currency/transaction-card";

export default function CurrencyDetail() {
  const [, params] = useRoute("/currency/:currencyId");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [mintOpen, setMintOpen] = useState(false);
  const [burnOpen, setBurnOpen] = useState(false);
  const [burnAmount, setBurnAmount] = useState("");
  const [burnReason, setBurnReason] = useState("");
  const [burnError, setBurnError] = useState<string | null>(null);
  const [burnSaving, setBurnSaving] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [transactionOffset, setTransactionOffset] = useState(0);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const PAGE_SIZE = 10;
  const MAX_NEGATIVE_LIMIT = 1_000_000_000;
  const [maxNegativeInput, setMaxNegativeInput] = useState<string>("");
  const [maxNegativeSaving, setMaxNegativeSaving] = useState(false);
  const [maxNegativeError, setMaxNegativeError] = useState<string | null>(null);

  // Load account context from localStorage
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

  const currencyId = params?.currencyId;

  const { data: currency } = useQuery({
    queryKey: ["currency", currencyId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/currencies/${currencyId}`);
      return response.data;
    },
    enabled: !!currencyId,
  });

  useEffect(() => {
    if (currency) {
      if (currency.maxNegativeBalance !== null && currency.maxNegativeBalance !== undefined) {
        setMaxNegativeInput(Math.abs(Number(currency.maxNegativeBalance)).toString());
      } else {
        setMaxNegativeInput("");
      }
    }
  }, [currency]);

  const { data: accountDetails } = useQuery({
    queryKey: ["accountDetails", currencyId, accountContext],
    queryFn: async () => {
      const params = accountContext?.type === "group"
        ? `?accountType=group&accountId=${accountContext.id}`
        : "";
      const response = await apiClient.get(`/api/ledger/account-details/${currencyId}${params}`);
      return response.data;
    },
    enabled: !!currencyId,
  });

  const { data: balance } = useQuery({
    queryKey: ["balance", currencyId, accountContext],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("currencyId", currencyId || "");
      if (accountContext?.type === "group") {
        params.append("accountType", "group");
        params.append("accountId", accountContext.id);
      }
      const response = await apiClient.get(`/api/ledger/balance?${params.toString()}`);
      return response.data;
    },
    enabled: !!currencyId,
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

  const { data: totalSupplyData, isLoading: totalSupplyLoading } = useQuery({
    queryKey: ["totalSupply", currencyId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/ledger/total-supply/${currencyId}`);
      return response.data;
    },
    enabled: !!currencyId,
  });

  const totalSupply = totalSupplyData?.totalSupply ?? 0;

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["history", currencyId, accountContext, transactionOffset],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("currencyId", currencyId || "");
      params.append("limit", String(PAGE_SIZE));
      params.append("offset", String(transactionOffset));
      if (accountContext?.type === "group") {
        params.append("accountType", "group");
        params.append("accountId", accountContext.id);
      }
      const response = await apiClient.get(`/api/ledger/history?${params.toString()}`);
      return response.data;
    },
    enabled: !!currencyId,
  });

  // Reset offset and transactions when currency or account context changes
  useEffect(() => {
    setTransactionOffset(0);
    setAllTransactions([]);
  }, [currencyId, accountContext]);

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

  const isAdminOfCurrency = currency && groups?.some((g: any) => g.id === currency.groupId && g.isAdmin);

  const saveMaxNegative = async () => {
    if (!currencyId) return;
    setMaxNegativeError(null);
    setMaxNegativeSaving(true);
    try {
      const trimmed = maxNegativeInput.trim();
      const isClearing = trimmed === "";
      let payloadValue: number | null = null;

      if (!isClearing) {
        const magnitude = parseFloat(trimmed);
        if (Number.isNaN(magnitude) || magnitude < 0) {
          setMaxNegativeError("Enter a valid non-negative number.");
          setMaxNegativeSaving(false);
          return;
        }
        if (magnitude > MAX_NEGATIVE_LIMIT) {
          setMaxNegativeError(`Maximum allowed is ${MAX_NEGATIVE_LIMIT.toLocaleString()}.`);
          setMaxNegativeSaving(false);
          return;
        }
        payloadValue = magnitude === 0 ? 0 : -Math.abs(magnitude);
      }

      await apiClient.patch(`/api/currencies/${currencyId}/max-negative`, {
        value: payloadValue,
      });

      await queryClient.invalidateQueries({ queryKey: ["currency", currencyId] });
      await queryClient.invalidateQueries({ queryKey: ["accountDetails", currencyId, accountContext] });
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || "Failed to update max negative balance";
      setMaxNegativeError(message);
    } finally {
      setMaxNegativeSaving(false);
    }
  };

  if (!currencyId) {
    return <div>Currency not found</div>;
  }

  const handleBurn = async () => {
    if (!currencyId) return;
    setBurnError(null);
    setBurnSaving(true);
    try {
      const amountNum = parseFloat(burnAmount);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        setBurnError("Enter a valid amount greater than zero.");
        setBurnSaving(false);
        return;
      }

      await apiClient.post("/api/ledger/burn", {
        currencyId,
        amount: amountNum,
        description: burnReason || undefined,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["balance", currencyId, accountContext] }),
        queryClient.invalidateQueries({ queryKey: ["balances", accountContext] }),
        queryClient.invalidateQueries({ queryKey: ["history", currencyId, accountContext, transactionOffset] }),
        queryClient.invalidateQueries({ queryKey: ["totalSupply", currencyId] }),
      ]);

      setBurnAmount("");
      setBurnReason("");
      setBurnOpen(false);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || "Burn failed";
      setBurnError(message);
    } finally {
      setBurnSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Same as dashboard */}
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
        {/* Back Button */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* Account Details */}
        {accountDetails && currency && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Your {currency.name} Account details</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Currency eName</h3>
                <p className="font-mono text-lg">{formatEName(currency.ename)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Account Balance</h3>
                <p className="text-2xl font-bold">
                  {balance?.balance
                    ? Number(balance.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                    : "0.00"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Negative Balance Allowed</h3>
                <p className={`text-lg font-medium ${currency.allowNegative ? "text-yellow-600" : "text-green-600"
                  }`}>
                  {currency.allowNegative ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Max Negative Balance</h3>
                <p className="text-lg font-medium">
                  {currency.allowNegative
                    ? (currency.maxNegativeBalance !== null && currency.maxNegativeBalance !== undefined
                      ? Number(currency.maxNegativeBalance).toLocaleString()
                      : "No cap")
                    : "Not applicable"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Currency Supply</h3>
                <p className="text-lg font-semibold">
                  {totalSupplyLoading ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : (
                    Number(totalSupply).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Max Negative Control - only for admins when negatives are allowed */}
        {currency && currency.allowNegative && isAdminOfCurrency && accountContext?.type === "group" && accountContext.id === currency.groupId && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-2">Set max negative balance</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Limit how far any account can go negative for this currency. Enter the absolute value (max {MAX_NEGATIVE_LIMIT.toLocaleString()}).
              Leave blank for no cap.
            </p>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Max negative (absolute value)</label>
                  <input
                    type="number"
                    min={0}
                    max={MAX_NEGATIVE_LIMIT}
                    step={0.01}
                    value={maxNegativeInput}
                    onChange={(e) => setMaxNegativeInput(e.target.value)}
                    placeholder="Leave blank for no cap"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={saveMaxNegative}
                    disabled={maxNegativeSaving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {maxNegativeSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setMaxNegativeInput("")}
                    disabled={maxNegativeSaving}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {maxNegativeError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg">
                  {maxNegativeError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Transactions</h2>
            <div className="flex gap-2">
              {isAdminOfCurrency && accountContext?.type === "group" && accountContext.id === currency.groupId && (
                    <>
                  <button
                    onClick={() => setMintOpen(true)}
                    className="px-6 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 flex items-center gap-2 font-medium"
                  >
                    <Sparkles className="h-4 w-4" />
                    Mint
                  </button>
                  <button
                        onClick={() => setBurnOpen(true)}
                        className="px-6 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 font-medium"
                        title="Burn from treasury"
                  >
                    <Flame className="h-4 w-4 text-red-500" />
                    Burn
                  </button>
                    </>
              )}
              <button
                onClick={() => setTransferOpen(true)}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-2 font-medium"
              >
                <Send className="h-4 w-4" />
                Make a transfer
              </button>
            </div>
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
              <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
              <p className="text-muted-foreground mb-4">
                Your transaction history for this currency will appear here.
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

      <TransferModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        fromCurrencyId={currencyId}
        accountContext={accountContext}
      />
      <TransactionDetailModal
        open={!!selectedTransactionId}
        onOpenChange={(open) => !open && setSelectedTransactionId(null)}
        transactionId={selectedTransactionId || undefined}
      />
      {currencyId && (
        <MintCurrencyModal
          open={mintOpen}
          onOpenChange={setMintOpen}
          currencyId={currencyId}
        />
      )}
      {burnOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setBurnOpen(false)}>
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Burn from Treasury</h3>
              <button onClick={() => setBurnOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={burnAmount}
                  onChange={(e) => setBurnAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={burnReason}
                  onChange={(e) => setBurnReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., supply reduction"
                />
              </div>
              {burnError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md">
                  {burnError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setBurnOpen(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                  disabled={burnSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBurn}
                  disabled={burnSaving || !burnAmount}
                  className="px-4 py-2 bg-destructive text-white rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  {burnSaving ? "Burning..." : "Burn"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

