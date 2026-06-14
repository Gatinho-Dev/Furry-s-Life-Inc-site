import wordmark from "@/assets/fli-wordmark.png.asset.json";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 md:pt-44 md:pb-32">
      <div className="absolute inset-0 bg-grid" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <div className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Holding corporativa multissetorial
        </div>

        <img src={wordmark.url} alt="Furry's Life Inc."
          className="mx-auto mt-8 h-20 w-auto animate-float-slow opacity-95 md:h-28" />

        <h1 className="mt-6 animate-fade-up text-balance font-display text-4xl font-bold leading-tight md:text-6xl">
          <span className="text-gradient">Furry's Life Inc.</span>
          <span className="mt-2 block text-xl font-medium text-muted-foreground md:text-2xl">
            Holding corporativa multissetorial
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl animate-fade-up text-balance text-base text-muted-foreground md:text-lg">
          Conectando criatividade, tecnologia e experiências para o futuro.
        </p>

        <div className="mt-9 flex animate-fade-up flex-wrap items-center justify-center gap-3">
          <a href="#subsidiarias"
            className="glass-button group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
            Conheça nossas subsidiárias
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a href="#contato"
            className="glass-button inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
            Entrar em contato
          </a>
        </div>
      </div>
    </section>
  );
}
