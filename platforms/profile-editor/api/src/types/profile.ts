export interface WorkExperience {
    id?: string;
    company: string;
    role: string;
    description?: string;
    startDate: string;
    endDate?: string;
    location?: string;
    sortOrder: number;
}

export interface Education {
    id?: string;
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startDate: string;
    endDate?: string;
    description?: string;
    sortOrder: number;
}

export interface SocialLink {
    id?: string;
    platform: string;
    url: string;
    label?: string;
}

/** The full professional-profile payload stored in the eVault PROFESSIONAL envelope. */
export interface ProfessionalProfile {
    displayName?: string;
    headline?: string;
    bio?: string;
    avatar?: string;
    banner?: string;
    cvFileId?: string;
    videoIntroFileId?: string;
    email?: string;
    phone?: string;
    website?: string;
    location?: string;
    isPublic?: boolean;
    workExperience?: WorkExperience[];
    education?: Education[];
    skills?: string[];
    socialLinks?: SocialLink[];
}

/** The shape returned to the client. */
export interface FullProfile {
    ename: string;
    name?: string;
    handle?: string;
    isVerified?: boolean;
    professional: Required<
        Pick<
            ProfessionalProfile,
            "workExperience" | "education" | "skills" | "socialLinks"
        >
    > &
        Omit<
            ProfessionalProfile,
            "workExperience" | "education" | "skills" | "socialLinks"
        >;
}
