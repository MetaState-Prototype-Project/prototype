import { apiClient } from "./apiClient";
import type { ProfessionalProfile } from "../types/profile";

export async function fetchProfessionalProfile(): Promise<ProfessionalProfile> {
    const { data } = await apiClient.get<ProfessionalProfile>(
        "/api/professional-profile",
    );
    return data;
}

export async function updateProfessionalProfile(
    profile: Partial<ProfessionalProfile>,
): Promise<ProfessionalProfile> {
    const { data } = await apiClient.patch<ProfessionalProfile>(
        "/api/professional-profile",
        profile,
    );
    return data;
}
