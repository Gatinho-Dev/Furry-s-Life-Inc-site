import {
  Gamepad2, Ship, Palmtree, GraduationCap, Building2, Tent, FlaskConical,
  Drama, Atom, Server, Trophy, Shield, HeartPulse, Wind,
  type LucideIcon,
} from "lucide-react";

export const DISCORD_URL = "https://discord.gg/bSNw4nQnwV";

export type SubsidiaryKey =
  | "studios" | "cruise" | "maldivas" | "college" | "cond" | "camping" | "labs"
  | "theater" | "energy" | "server" | "soccer" | "agency" | "lifeplus" | "aircare";

export type Subsidiary = {
  key: SubsidiaryKey;
  name: string;
  category: string;
  description: string;
  icon: LucideIcon;
  /** Caminho do mini-site interno. Vazio = ainda não publicado. */
  href?: string;
  /** Link externo (ex.: Life Server bio.site). */
  externalHref?: string;
};

export const subsidiaries: Subsidiary[] = [
  { key: "studios",  name: "Furry's Life Studios",         category: "Jogos & Mídia",     description: "Estúdio de jogos e experiências digitais imersivas.",            icon: Gamepad2 },
  { key: "cruise",   name: "Furry's Life Cruise",          category: "Turismo",           description: "Companhia privada de cruzeiros de luxo.",                       icon: Ship },
  { key: "maldivas", name: "Furry Maldivas",               category: "Hotelaria",         description: "Hotel e resort cinco estrelas em destino paradisíaco.",         icon: Palmtree },
  { key: "college",  name: "Life College",                 category: "Educação",          description: "Universidade privada com excelência acadêmica.",                icon: GraduationCap, href: "/college" },
  { key: "cond",     name: "Furry's Life Cond.",           category: "Imobiliário",       description: "Condomínio privado de alto padrão.",                            icon: Building2,    href: "/cond" },
  { key: "camping",  name: "Furry's Life Camping",         category: "Lazer",             description: "Área de acampamento e atividades ao ar livre.",                 icon: Tent },
  { key: "labs",     name: "Furry's Life Labs",            category: "Pesquisa",          description: "Laboratório de pesquisas, ciência e inovação.",                 icon: FlaskConical },
  { key: "theater",  name: "Furry's Life Theater",         category: "Cultura",           description: "Teatro e entretenimento cultural premium.",                     icon: Drama },
  { key: "energy",   name: "Furry's Life Energy Complex",  category: "Energia",           description: "Complexo de geração de energia nuclear limpa.",                 icon: Atom },
  { key: "server",   name: "Life Server",                  category: "Comunidades",       description: "Servidores de Roblox e comunidades criativas.",                 icon: Server,       href: "/life-server", externalHref: "https://bio.site/lifeserver" },
  { key: "soccer",   name: "Life Soccer",                  category: "Esportes",          description: "Clube de futebol e organização de eventos esportivos.",         icon: Trophy },
  { key: "agency",   name: "Life Agency",                  category: "Inteligência",      description: "Agência de inteligência e operações especiais.",                icon: Shield,       href: "/agency" },
  { key: "lifeplus", name: "Life+",                        category: "Saúde",             description: "Serviços de saúde, bem-estar e medicina preventiva.",           icon: HeartPulse },
  { key: "aircare",  name: "Life AirCare",                 category: "Sustentabilidade",  description: "Purificação do ar e tecnologias ambientais.",                   icon: Wind },
];

export const newsItems = [
  { date: "08 Jun 2026", tag: "Institucional", title: "Furry's Life Inc. anuncia nova holding em expansão global", description: "A organização principal apresenta seu plano de expansão para os próximos cinco anos com foco em sustentabilidade e tecnologia." },
  { date: "02 Jun 2026", tag: "Energia", title: "Energy Complex atinge 100% de operação", description: "O complexo nuclear conclui testes finais e entra em plena operação comercial, abastecendo todas as subsidiárias." },
  { date: "27 Mai 2026", tag: "Educação", title: "Life College abre inscrições para o semestre 2026.2", description: "Mais de 40 cursos disponíveis, com bolsas integrais para alunos destaque das comunidades parceiras." },
  { date: "19 Mai 2026", tag: "Tecnologia", title: "Life Server lança nova infraestrutura dedicada", description: "Servidores otimizados oferecem latência ultra baixa e novos recursos para comunidades criativas." },
];

export const SUBSIDIARY_LABELS: Record<string, string> = {
  fli: "Furry's Life Inc.",
  studios: "Furry's Life Studios",
  cruise: "Furry's Life Cruise",
  maldivas: "Furry Maldivas",
  college: "Life College",
  cond: "Furry's Life Cond.",
  camping: "Furry's Life Camping",
  labs: "Furry's Life Labs",
  theater: "Furry's Life Theater",
  energy: "Furry's Life Energy Complex",
  server: "Life Server",
  soccer: "Life Soccer",
  agency: "Life Agency",
  lifeplus: "Life+",
  aircare: "Life AirCare",
};
