import { authInterceptor } from "./auth.interceptor";
import { creationInterceptor } from "./creation.interceptor";

// Auth retries must also traverse proof negotiation, including retained permits.
export const API_INTERCEPTORS = [authInterceptor, creationInterceptor];
