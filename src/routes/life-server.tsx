import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/life-server")({
  beforeLoad: () => {
    throw redirect({ href: "https://bio.site/lifeserver" });
  },
});
