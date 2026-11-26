/**
 * Marca da Life+ — coração em fita com a cruz, em SVG vetorial (public/brand).
 * O logotipo combina a marca com o nome institucional, sempre legível em qualquer tamanho.
 */
import type { CSSProperties } from "react";

export const LIFE_MARK_SRC = "/brand/lifeplus-mark.svg";

export function LifeMark({
  size = 36,
  alt = "Life+ Serviços Médicos",
  className = "",
  style,
}: {
  size?: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={LIFE_MARK_SRC}
      alt={alt}
      width={size}
      height={size}
      decoding="async"
      className={`life-mark ${className}`.trim()}
      style={{ width: size, height: size, ...style }}
    />
  );
}

export function LifeLogo({
  size = 38,
  tagline = "SERVIÇOS MÉDICOS",
  invert = false,
  className = "",
}: {
  size?: number;
  tagline?: string | null;
  invert?: boolean;
  className?: string;
}) {
  return (
    <span className={`life-logo ${invert ? "is-invert" : ""} ${className}`.trim()}>
      <LifeMark size={size} alt="" className="life-logo-mark" />
      <span className="life-logo-type">
        <span className="life-logo-name" style={{ fontSize: Math.round(size * 0.62) }}>
          Life<span className="life-logo-plus">+</span>
        </span>
        {tagline ? (
          <span className="life-logo-tag" style={{ fontSize: Math.max(7, Math.round(size * 0.235)) }}>
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
