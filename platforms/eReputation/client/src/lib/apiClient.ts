import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";

const baseURL = import.meta.env.VITE_EREPUTATION_BASE_URL || "http://localhost:8765";

console.log("🔍 Environment variables:", {
  VITE_EREPUTATION_BASE_URL: import.meta.env.VITE_EREPUTATION_BASE_URL,
  baseURL: baseURL,
  allEnv: import.meta.env
});

export const apiClient = axios.create({
    baseURL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config: AxiosRequestConfig) => {
        const token = localStorage.getItem("ereputation_token");
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("ereputation_token");
            localStorage.removeItem("ereputation_user_id");
            window.location.href = "/auth";
        }
        return Promise.reject(error);
    }
);
