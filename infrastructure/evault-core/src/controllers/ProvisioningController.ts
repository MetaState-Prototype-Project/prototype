import { Request, Response } from "express";
import { ProvisioningService, ProvisionRequest, ProvisionResponse } from "../services/ProvisioningService";

export class ProvisioningController {
    constructor(private readonly provisioningService: ProvisioningService) {}

    registerRoutes(app: any) {
        app.post(
            "/provision",
            async (
                req: Request<{}, {}, ProvisionRequest>,
                res: Response<ProvisionResponse>
            ) => {
                try {
                    const result = await this.provisioningService.provisionEVault(req.body);
                    
                    if (!result.success) {
                        const status = result.duplicate ? 409 : 500;
                        return res.status(status).json(result);
                    }
                    
                    res.json(result);
                } catch (error) {
                    console.error("Provisioning error:", error);
                    res.status(500).json({
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        message: "Failed to provision evault instance",
                    });
                }
            }
        );
    }
}

