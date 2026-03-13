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

export interface ProfessionalProfile {
    displayName?: string;
    headline?: string;
    bio?: string;
    avatarFileId?: string;
    bannerFileId?: string;
    cvFileId?: string;
    videoIntroFileId?: string;
    email?: string;
    phone?: string;
    website?: string;
    location?: string;
    isPublic?: boolean;
    isDreamsyncVisible?: boolean;
    workExperience?: WorkExperience[];
    education?: Education[];
    skills?: string[];
    socialLinks?: SocialLink[];
}

export interface UserOntologyData {
    username?: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    ename?: string;
    isVerified?: boolean;
    isPrivate?: boolean;
    location?: string;
    website?: string;
}

export interface FullProfile {
    ename: string;
    name?: string;
    handle?: string;
    isVerified?: boolean;
    professional: ProfessionalProfile;
}
