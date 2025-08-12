import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";

const baseURL = process.env.NEXT_PUBLIC_EVOTING_BASE_URL || "http://localhost:7777";

export const apiClient = axios.create({
    baseURL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config: AxiosRequestConfig) => {
        const token = localStorage.getItem("evoting_token");
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
            localStorage.removeItem("evoting_token");
            localStorage.removeItem("evoting_user_id");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
); 