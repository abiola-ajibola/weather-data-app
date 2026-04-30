import {
  routes,
  deploymentEnv,
  type VercelConfig,
  Rewrite,
} from "@vercel/config/v1";

export const config: VercelConfig = {
  rewrites: [
    routes.rewrite("/api/(.*)", `${deploymentEnv("BACKEND_URL")}/$1`, {
      requestHeaders: {
        authorization: `Bearer ${deploymentEnv("API_TOKEN")}`,
      },
    }) as Rewrite,
  ],
};
