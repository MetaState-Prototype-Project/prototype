import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";

const baseURL = import.meta.env.VITE_ECURRENCY_API_URL || "http://localhost:8989";

console.log("🔍 Environment variables:", {
  VITE_ECURRENCY_API_URL: import.meta.env.VITE_ECURRENCY_API_URL,
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
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem("ecurrency_token");
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
            localStorage.removeItem("ecurrency_token");
            localStorage.removeItem("ecurrency_user");
            window.location.href = "/auth";
        }
        return Promise.reject(error);
    }
);

