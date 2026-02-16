/**
 * Request-scoped context system to track database operation origins
 * This ensures we only trigger webhooks for operations from specific services
 */

interface OperationContext {
    serviceName: string;
    operationId: string;
    timestamp: number;
}

class OperationContextManager {
    private static instance: OperationContextManager;
    private contexts: Map<string, OperationContext> = new Map();
    private readonly CONTEXT_EXPIRY_MS = 30_000; // 30 seconds

    static getInstance(): OperationContextManager {
        if (!OperationContextManager.instance) {
            OperationContextManager.instance = new OperationContextManager();
        }
        return OperationContextManager.instance;
    }

    /**
     * Create a new operation context for a specific service
     */
    createContext(serviceName: string, operationId: string): string {
        const contextKey = `${serviceName}:${operationId}:${Date.now()}`;
        const context: OperationContext = {
            serviceName,
            operationId,
            timestamp: Date.now()
        };
        
        this.contexts.set(contextKey, context);
        
        // Clean up expired contexts
        this.cleanupExpiredContexts();
        
        console.log(`🔧 Created operation context: ${contextKey}`);
        return contextKey;
    }

    /**
     * Check if an operation should be processed based on context
     * Only applies protection to groups and messages entities
     */
    shouldProcessOperation(entityId: string, tableName: string): boolean {
        // Only apply context protection to groups and messages
        const protectedEntities = ['groups', 'messages'];
        if (!protectedEntities.includes(tableName.toLowerCase())) {
            console.log(`✅ Entity ${tableName} is not protected, allowing operation for ${entityId}`);
            return true;
        }

        // Look for any active context from trusted services
        const trustedServices = ['ConsentService', 'AIMatchingService', 'MatchNotificationService', 'GroupService'];
        for (const [contextKey, context] of this.contexts.entries()) {
            if (trustedServices.includes(context.serviceName)) {
                console.log(`✅ Found ${context.serviceName} context: ${contextKey}, processing protected operation for ${tableName}:${entityId}`);
                return true;
            }
        }
        
        console.log(`❌ No trusted service context found, skipping protected operation for ${tableName}:${entityId}`);
        return false;
    }

    /**
     * Remove a specific context
     */
    removeContext(contextKey: string): void {
        if (this.contexts.delete(contextKey)) {
            console.log(`🗑️ Removed operation context: ${contextKey}`);
        }
    }

    /**
     * Clean up expired contexts
     */
    private cleanupExpiredContexts(): void {
        const now = Date.now();
        for (const [contextKey, context] of this.contexts.entries()) {
            if (now - context.timestamp > this.CONTEXT_EXPIRY_MS) {
                this.contexts.delete(contextKey);
                console.log(`🧹 Cleaned up expired context: ${contextKey}`);
            }
        }
    }

    /**
     * Get all active contexts (for debugging)
     */
    getActiveContexts(): Map<string, OperationContext> {
        return new Map(this.contexts);
    }
}

export const operationContextManager = OperationContextManager.getInstance();

/**
 * Decorator to wrap database operations with context
 */
export function withOperationContext<T>(
    serviceName: string, 
    operationId: string, 
    operation: () => Promise<T>
): Promise<T> {
    const contextKey = operationContextManager.createContext(serviceName, operationId);
    
    return operation().finally(() => {
        // Remove context after operation completes
        setTimeout(() => {
            operationContextManager.removeContext(contextKey);
        }, 1000); // Small delay to ensure all database operations complete
    });
}

/**
 * Check if current operation should be processed by webhooks
 */
export function shouldProcessWebhook(entityId: string, tableName: string): boolean {
    return operationContextManager.shouldProcessOperation(entityId, tableName);
}
