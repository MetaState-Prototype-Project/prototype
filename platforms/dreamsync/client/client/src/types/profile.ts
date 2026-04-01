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

export interface ProfessionalProfile {
    displayName?: string;
    headline?: string;
    bio?: string;
    location?: string;
    skills?: string[];
    workExperience?: WorkExperience[];
    education?: Education[];
    isPublic?: boolean;
}
