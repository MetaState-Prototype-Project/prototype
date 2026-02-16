import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios";

const baseURL = import.meta.env.VITE_DREAMSYNC_BASE_URL || "http://localhost:8888";


console.log("🔍 Environment variables:", {
  VITE_DREAMSYNC_BASE_URL: import.meta.env.VITE_DREAMSYNC_BASE_URL,
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
        const token = localStorage.getItem("dreamsync_token");
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
            localStorage.removeItem("dreamsync_token");
            localStorage.removeItem("dreamsync_user_id");
            window.location.href = "/";
        }
        return Promise.reject(error);
    }
);
