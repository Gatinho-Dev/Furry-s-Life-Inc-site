import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { About } from "@/components/site/About";
import { Subsidiaries } from "@/components/site/Subsidiaries";
import { News } from "@/components/site/News";
import { Contact } from "@/components/site/Contact";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Furry's Life Inc. — Holding corporativa" },
      { name: "description", content: "Furry's Life Inc. administra 14 subsidiárias em tecnologia, entretenimento, turismo, educação, saúde, energia e mais." },
      { property: "og:title", content: "Furry's Life Inc." },
      { property: "og:description", content: "Conectando criatividade, tecnologia e experiências para o futuro." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Subsidiaries />
        <News />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
