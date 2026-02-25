import axios from "axios";
import { PUBLIC_ESIGNER_BASE_URL } from "$env/static/public";

const API_BASE_URL = PUBLIC_ESIGNER_BASE_URL || "http://localhost:3004";

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

export const setAuthToken = (token: string) => {
    localStorage.setItem("esigner_auth_token", token);
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

export const removeAuthToken = () => {
    localStorage.removeItem("esigner_auth_token");
    delete apiClient.defaults.headers.common["Authorization"];
};

export const removeAuthId = () => {
    localStorage.removeItem("esigner_auth_id");
};
