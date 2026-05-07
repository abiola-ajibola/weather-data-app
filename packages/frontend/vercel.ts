import {
  routes,
  deploymentEnv,
  type VercelConfig,
  Rewrite,
} from "@vercel/config/v1";

export const config: VercelConfig = {
  rewrites: [
    routes.rewrite("/api/(.*)", `${deploymentEnv("BACKEND_URL")}/api/$1`, {
      requestHeaders: {
        authorization: `Bearer ${deploymentEnv("API_TOKEN")}`,
      },
    }) as Rewrite,
    routes.rewrite("/auth/(.*)", `${deploymentEnv("BACKEND_URL")}/auth/$1`),
    routes.rewrite("/(.*)", "/"),
  ],
};
